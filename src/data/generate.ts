/**
 * Synthetic bank graph with ONE planted laundering ring hidden in the noise.
 * Deterministic (seeded) so your demo is identical every run.
 *
 *   npm run seed          # writes to Neo4j (needs .env) + dumps demo-graph.json
 *   npm run seed -- --json-only   # just regenerate the demo snapshot
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getSession, closeDriver } from '../lib/neo4j.js';
import { SCHEMA, WIPE } from './queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- tiny seeded PRNG (mulberry32) so the graph is reproducible ------------
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

type Account = { id: string; name: string; balance: number; openedDaysAgo: number; flagged: boolean };
type Edge = { src: string; dst: string; amount: number; ts: number };
type Link = { account: string; target: string; kind: 'device' | 'ip' };

const LEGIT_ACCOUNTS = 180;
const RING_SIZE = 9; // 8 smurfs + 1 mule

const FIRST = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Kai', 'Ivy', 'Leo', 'Nia', 'Eli', 'Ada', 'Ravi', 'Sana', 'Omar', 'Yuki'];
const LAST = ['Cole', 'Reed', 'Vale', 'Park', 'Shah', 'Kim', 'Rossi', 'Diaz', 'Chen', 'Bauer', 'Okafor', 'Ali'];

function build() {
  const accounts: Account[] = [];
  const devices: string[] = [];
  const ips: string[] = [];
  const links: Link[] = [];
  const tx: Edge[] = [];

  // ---- legit population: mostly unique device/ip, small random payments ----
  for (let i = 0; i < LEGIT_ACCOUNTS; i++) {
    const id = `ACC-${1000 + i}`;
    accounts.push({
      id,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      balance: int(200, 25000),
      openedDaysAgo: int(90, 2200),
      flagged: false,
    });
    const dev = `DEV-${i}`; devices.push(dev);
    const ip = `IP-${i}`; ips.push(ip);
    links.push({ account: id, target: dev, kind: 'device' });
    links.push({ account: id, target: ip, kind: 'ip' });
  }
  // background transactions between random legit accounts
  for (let i = 0; i < 420; i++) {
    const a = pick(accounts), b = pick(accounts);
    if (a.id === b.id) continue;
    tx.push({ src: a.id, dst: b.id, amount: int(5, 900), ts: Date.now() - int(1, 90) * 86400000 });
  }

  // ---- the planted ring: shared hardware + funnel into a mule --------------
  const ring: Account[] = [];
  for (let i = 0; i < RING_SIZE; i++) {
    const id = `ACC-RING-${i}`;
    ring.push({
      id,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      balance: int(50, 1500),
      openedDaysAgo: int(3, 21), // freshly created accounts = classic tell
      flagged: false,
    });
  }
  accounts.push(...ring);
  const mule = ring[RING_SIZE - 1];

  // ring shares just 2 devices + 2 IPs across all members (the hidden signal)
  const ringDevices = ['DEV-RING-A', 'DEV-RING-B'];
  const ringIps = ['IP-RING-A', 'IP-RING-B'];
  devices.push(...ringDevices); ips.push(...ringIps);
  for (const a of ring) {
    links.push({ account: a.id, target: pick(ringDevices), kind: 'device' });
    links.push({ account: a.id, target: pick(ringIps), kind: 'ip' });
  }
  // smurfs funnel small "under the radar" amounts into the mule
  for (const a of ring.slice(0, RING_SIZE - 1)) {
    const n = int(2, 4);
    for (let k = 0; k < n; k++) {
      tx.push({ src: a.id, dst: mule.id, amount: int(2000, 4800), ts: Date.now() - int(1, 10) * 86400000 });
    }
  }
  // a few ring members also touch legit accounts, to bury the pattern in noise
  for (const a of ring.slice(0, 3)) {
    tx.push({ src: a.id, dst: pick(accounts).id, amount: int(20, 300), ts: Date.now() - int(1, 30) * 86400000 });
  }

  return { accounts, devices, ips, links, tx, ring: ring.map((r) => r.id), mule: mule.id };
}

async function loadNeo4j(g: ReturnType<typeof build>) {
  const session = getSession();
  try {
    for (const stmt of SCHEMA) await session.run(stmt);
    await session.run(WIPE);
    await session.run(
      `UNWIND $rows AS r CREATE (a:Account {id:r.id, name:r.name, balance:r.balance, openedDaysAgo:r.openedDaysAgo, flagged:false})`,
      { rows: g.accounts },
    );
    await session.run(`UNWIND $ids AS id MERGE (:Device {id:id})`, { ids: g.devices });
    await session.run(`UNWIND $ids AS id MERGE (:IP {id:id})`, { ids: g.ips });
    await session.run(
      `UNWIND $rows AS r MATCH (a:Account {id:r.account})
       MATCH (t {id:r.target})
       CALL apoc.do.when(r.kind='device',
         'MERGE (a)-[:USED_DEVICE]->(t)', 'MERGE (a)-[:USED_IP]->(t)',
         {a:a,t:t}) YIELD value RETURN count(*)`,
      { rows: g.links },
    ).catch(async () => {
      // fallback if APOC isn't available on the Aura tier
      await session.run(
        `UNWIND $rows AS r MATCH (a:Account {id:r.account}) MATCH (d:Device {id:r.target}) WHERE r.kind='device' MERGE (a)-[:USED_DEVICE]->(d)`,
        { rows: g.links },
      );
      await session.run(
        `UNWIND $rows AS r MATCH (a:Account {id:r.account}) MATCH (i:IP {id:r.target}) WHERE r.kind='ip' MERGE (a)-[:USED_IP]->(i)`,
        { rows: g.links },
      );
    });
    await session.run(
      `UNWIND $rows AS r MATCH (a:Account {id:r.src}) MATCH (b:Account {id:r.dst})
       CREATE (a)-[:SENT {amount:r.amount, ts:r.ts}]->(b)`,
      { rows: g.tx },
    );
    console.log(`✅ Neo4j seeded: ${g.accounts.length} accounts, ${g.tx.length} transactions, ring=${g.ring.length}`);
  } finally {
    await session.close();
  }
}

async function main() {
  const jsonOnly = process.argv.includes('--json-only');
  const g = build();

  // demo-mode snapshot: lets the whole UI run with zero live services
  writeFileSync(join(__dirname, 'demo-graph.json'), JSON.stringify(g, null, 2));
  console.log(`📸 demo snapshot written (${g.accounts.length} accounts)`);

  if (!jsonOnly && process.env.NEO4J_URI) {
    await loadNeo4j(g);
    await closeDriver();
  } else {
    console.log('ℹ️  skipped Neo4j load (no NEO4J_URI or --json-only). Demo mode still works.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
