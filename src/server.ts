/**
 * Dragnet orchestration server — the glue that makes all four sponsors
 * load-bearing in one request flow:
 *
 *   Neo4j (GDS community detection + betweenness)  -> finds the ring + the mule
 *   RocketRide Cloud (deployed pipeline)           -> scores + narrates it
 *   Cognee (memory)                                -> "seen this typology before?"
 *   Butterbase (auth + db + Stripe payment)        -> login, save case, paywall
 *
 * DEMO_MODE (default when NEO4J_URI is unset) runs the entire thing off a
 * seeded snapshot so the visual demo is bulletproof on stage.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { getSession, hasNeo4j } from './lib/neo4j.js';
import * as Q from './data/queries.js';
import * as BB from './lib/butterbase.js';
import { investigateRing, hasRocketRide } from './lib/rocketride.js';
import { recall, remember, hasCognee } from './lib/cognee.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(readFileSync(join(__dirname, 'data', 'demo-graph.json'), 'utf8')) as Snapshot;

type Snapshot = {
  accounts: { id: string; name: string; balance: number; openedDaysAgo: number; flagged: boolean }[];
  links: { account: string; target: string; kind: 'device' | 'ip' }[];
  tx: { src: string; dst: string; amount: number; ts: number }[];
  ring: string[];
  mule: string;
};

const app = express();
app.use(cors());
app.use(express.json());

const nameOf = (id: string) => snapshot.accounts.find((a) => a.id === id)?.name ?? id;

// ---------------------------------------------------------------------------
// Health / capability banner (nice for the demo: shows what's live vs mocked)
// ---------------------------------------------------------------------------
app.get('/api/status', (_req, res) => {
  res.json({
    neo4j: hasNeo4j(),
    rocketride: hasRocketRide(),
    butterbase: BB.hasButterbase(),
    cognee: hasCognee(),
    mode: hasNeo4j() ? 'live-graph' : 'demo-snapshot',
  });
});

// ---------------------------------------------------------------------------
// Initial graph: accounts + money-flow edges (the ring is invisible here)
// ---------------------------------------------------------------------------
app.get('/api/graph/initial', async (_req, res) => {
  const nodes = snapshot.accounts.map((a) => ({
    id: a.id, name: a.name, type: 'account', community: -1, betweenness: 0, flagged: a.flagged,
  }));
  const links = snapshot.tx.slice(0, 260).map((t) => ({ source: t.src, target: t.dst, kind: 'money', amount: t.amount }));
  res.json({ nodes, links });
});

// ---------------------------------------------------------------------------
// Live transaction stream (SSE) — animates the feed so the room feels a pulse
// ---------------------------------------------------------------------------
app.get('/api/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (d: unknown) => res.write(`data: ${JSON.stringify(d)}\n\n`);
  const accts = snapshot.accounts;
  const timer = setInterval(() => {
    const a = accts[Math.floor(Math.random() * accts.length)];
    const b = accts[Math.floor(Math.random() * accts.length)];
    if (a.id !== b.id) send({ src: a.id, dst: b.id, amount: 5 + Math.floor(Math.random() * 900) });
  }, 650);
  req.on('close', () => clearInterval(timer));
});

// ---------------------------------------------------------------------------
// DETECT: the money shot. Neo4j GDS surfaces the ring; RocketRide narrates it.
// ---------------------------------------------------------------------------
app.post('/api/detect', async (_req, res) => {
  try {
    const ring = hasNeo4j() ? await detectWithCypher() : detectFromSnapshot();

    // RocketRide Cloud: score + narrate the multi-agent investigation
    const verdict = await investigateRing({
      ringId: ring.ringId,
      accounts: ring.nodes.map((n) => ({ id: n.id, name: n.name, openedDaysAgo: n.openedDaysAgo, betweenness: n.betweenness })),
      mule: ring.mule,
      totalAmount: ring.totalAmount,
      sharedDevices: ring.sharedDevices,
      txCount: ring.internalTx,
    });

    // Cognee: have we confirmed a ring like this before?
    const memory = await recall(verdict.typology, ring.nodes.length);

    res.json({ ring, verdict, memory });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

type DetectedRing = {
  ringId: string;
  nodes: { id: string; name: string; openedDaysAgo: number; betweenness: number; isMule: boolean }[];
  links: { source: string; target: string; kind: 'money' | 'shared'; amount?: number }[];
  mule: string;
  totalAmount: number;
  sharedDevices: number;
  internalTx: number;
};

// ---- Neo4j native-Cypher path ---------------------------------------------
// Build the shared-fingerprint :LINKED subgraph, take the accounts in it (the
// ring — legit accounts have no LINKED edges), and pick the mule by internal
// received volume (degree/volume centrality). All graph-native, no GDS session.
async function detectWithCypher(): Promise<DetectedRing> {
  const s = getSession();
  try {
    await s.run(Q.CLEAR_LINKS);
    await s.run(Q.BUILD_LINKS);
    const res = await s.run(Q.RING_CANDIDATES);
    const members = res.records.map((r) => ({
      id: r.get('id') as string,
      name: r.get('name') as string,
      openedDaysAgo: Number(r.get('openedDaysAgo')),
      betweenness: 0, // filled below with internal-received volume
    }));

    const txRes = await s.run(Q.FETCH_TX);
    const tx = txRes.records.map((r) => ({ src: r.get('src') as string, dst: r.get('dst') as string, amount: Number(r.get('amount')) }));

    // volume centrality: the account that RECEIVES the most from inside the ring is the mule
    const ids = new Set(members.map((m) => m.id));
    const incoming = new Map<string, number>();
    for (const t of tx) if (ids.has(t.src) && ids.has(t.dst)) incoming.set(t.dst, (incoming.get(t.dst) || 0) + t.amount);
    for (const m of members) m.betweenness = incoming.get(m.id) || 0;

    return assemble(members, tx);
  } finally {
    await s.close();
  }
}

function assemble(
  members: { id: string; name: string; openedDaysAgo: number; betweenness: number }[],
  tx: { src: string; dst: string; amount: number }[],
): DetectedRing {
  const ids = new Set(members.map((m) => m.id));
  const mule = members.slice().sort((a, b) => b.betweenness - a.betweenness)[0]?.id ?? members[0]?.id;
  const internal = tx.filter((t) => ids.has(t.src) && ids.has(t.dst));
  const moneyLinks = internal.map((t) => ({ source: t.src, target: t.dst, kind: 'money' as const, amount: t.amount }));
  const { edges: sharedLinks, sharedTargets } = sharedDeviceEdges([...ids]);
  return {
    ringId: `RING-${mule}`,
    nodes: members.map((m) => ({ id: m.id, name: m.name, openedDaysAgo: m.openedDaysAgo, betweenness: m.betweenness, isMule: m.id === mule })),
    links: [...moneyLinks, ...sharedLinks],
    mule,
    totalAmount: internal.reduce((s, t) => s + t.amount, 0),
    sharedDevices: sharedTargets, // distinct devices/IPs the ring shares (the real tell)
    internalTx: internal.length,
  };
}

// ---- Demo-snapshot path (no live services) --------------------------------
function detectFromSnapshot(): DetectedRing {
  const members = snapshot.accounts
    .filter((a) => snapshot.ring.includes(a.id))
    .map((a, i) => ({ id: a.id, name: a.name, openedDaysAgo: a.openedDaysAgo, betweenness: a.id === snapshot.mule ? 100 : 5 + i }));
  return assemble(members, snapshot.tx);
}

// shared device/IP edges among a set of accounts (the hidden link the ring hides behind).
// Returns the viz edges AND the count of distinct devices/IPs the ring actually shares.
function sharedDeviceEdges(ids: string[]): { edges: { source: string; target: string; kind: 'shared' }[]; sharedTargets: number } {
  const idset = new Set(ids);
  const byTarget = new Map<string, string[]>();
  for (const l of snapshot.links) {
    if (!idset.has(l.account)) continue;
    if (!byTarget.has(l.target)) byTarget.set(l.target, []);
    byTarget.get(l.target)!.push(l.account);
  }
  const edges: { source: string; target: string; kind: 'shared' }[] = [];
  const seen = new Set<string>();
  let sharedTargets = 0;
  for (const [, accts] of byTarget) {
    if (accts.length >= 2) sharedTargets++;
    for (let i = 0; i < accts.length; i++)
      for (let j = i + 1; j < accts.length; j++) {
        const key = [accts[i], accts[j]].sort().join('-');
        if (seen.has(key)) continue; seen.add(key);
        edges.push({ source: accts[i], target: accts[j], kind: 'shared' });
      }
  }
  return { edges, sharedTargets };
}

// ---------------------------------------------------------------------------
// Butterbase: auth, payment paywall, case persistence
// ---------------------------------------------------------------------------
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  res.json(await BB.login(email || 'investigator@bank.com', password || 'demo'));
});

app.post('/api/checkout', async (req, res) => {
  const { userId } = req.body || {};
  res.json(await BB.createCheckout(userId || 'demo-user'));
});

// Freeze = a PRO action. Free users get 402 -> the live payment moment.
app.post('/api/freeze', async (req, res) => {
  const { userId, ring, verdict } = req.body || {};
  if (!(await BB.isPro(userId || 'demo-user'))) {
    return res.status(402).json({ needsPayment: true, plan: 'pro', reason: 'Freezing & exporting cases is a Pro feature.' });
  }
  const ids: string[] = (ring?.nodes || []).map((n: any) => n.id);
  if (hasNeo4j()) {
    const s = getSession();
    try { await s.run(Q.FREEZE_RING, { ids }); } finally { await s.close(); }
  }
  const saved = await BB.saveCase({
    ringId: ring.ringId, accounts: ids, mule: ring.mule, amount: ring.totalAmount,
    score: verdict.riskScore, narrative: verdict.narrative, frozen: true,
  });
  // Cognee: remember this confirmed typology for next time
  await remember({ typology: verdict.typology, size: ids.length, ringId: ring.ringId, note: `${nameOf(ring.mule)} mule, $${ring.totalAmount}` });
  res.json({ frozen: ids.length, case: saved });
});

app.get('/api/cases', async (_req, res) => res.json(await BB.listCases()));

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`\n🕸️  Dragnet server on http://localhost:${PORT}`);
  console.log(`    neo4j=${hasNeo4j()}  rocketride=${hasRocketRide()}  butterbase=${BB.hasButterbase()}  cognee=${hasCognee()}`);
  console.log(`    mode=${hasNeo4j() ? 'LIVE GRAPH' : 'DEMO SNAPSHOT'}\n`);
});
