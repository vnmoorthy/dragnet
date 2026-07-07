export type GNode = { id: string; name: string; type: string; community: number; betweenness: number; flagged: boolean };
export type GLink = { source: string; target: string; kind: string; amount?: number };
export type GraphData = { nodes: GNode[]; links: GLink[] };

export type Ring = {
  ringId: string;
  nodes: { id: string; name: string; openedDaysAgo: number; betweenness: number; isMule: boolean }[];
  links: { source: string; target: string; kind: 'money' | 'shared'; amount?: number }[];
  mule: string;
  totalAmount: number;
  sharedDevices: number;
  internalTx: number;
};
export type Verdict = { riskScore: number; typology: string; narrative: string; recommendedAction: string };
export type DetectResult = { ring: Ring; verdict: Verdict; memory: string | null };
export type Status = { neo4j: boolean; rocketride: boolean; butterbase: boolean; cognee: boolean; mode: string };

// STATIC mode (VITE_STATIC=1) runs the whole demo client-side off the bundled
// snapshot — no backend — so it can be hosted on GitHub Pages as a live sample.
const STATIC = import.meta.env.VITE_STATIC === '1';

const j = (r: Response) => r.json();

// ------------------------------------------------------------------ live (API)
async function liveDetect(): Promise<DetectResult> { return fetch('/api/detect', { method: 'POST' }).then(j); }

// ---------------------------------------------------------------- static (demo)
import snapshot from './demo-graph.json';
type Snap = {
  accounts: { id: string; name: string; balance: number; openedDaysAgo: number; flagged: boolean }[];
  links: { account: string; target: string; kind: 'device' | 'ip' }[];
  tx: { src: string; dst: string; amount: number; ts: number }[];
  ring: string[];
  mule: string;
};
const snap = snapshot as Snap;
let staticPaid = false;

function sharedEdges(ids: string[]): { edges: { source: string; target: string; kind: 'shared' }[]; sharedTargets: number } {
  const idset = new Set(ids);
  const byTarget = new Map<string, string[]>();
  for (const l of snap.links) {
    if (!idset.has(l.account)) continue;
    (byTarget.get(l.target) ?? byTarget.set(l.target, []).get(l.target)!).push(l.account);
  }
  const edges: { source: string; target: string; kind: 'shared' }[] = [];
  const seen = new Set<string>();
  let sharedTargets = 0;
  for (const [, accts] of byTarget) {
    if (accts.length >= 2) sharedTargets++;
    for (let i = 0; i < accts.length; i++)
      for (let k = i + 1; k < accts.length; k++) {
        const key = [accts[i], accts[k]].sort().join('-');
        if (seen.has(key)) continue; seen.add(key);
        edges.push({ source: accts[i], target: accts[k], kind: 'shared' });
      }
  }
  return { edges, sharedTargets };
}

function staticDetect(): DetectResult {
  const members = snap.accounts
    .filter((a) => snap.ring.includes(a.id))
    .map((a, i) => ({ id: a.id, name: a.name, openedDaysAgo: a.openedDaysAgo, betweenness: a.id === snap.mule ? 100 : 5 + i }));
  const ids = new Set(members.map((m) => m.id));
  const mule = [...members].sort((a, b) => b.betweenness - a.betweenness)[0].id;
  const internal = snap.tx.filter((t) => ids.has(t.src) && ids.has(t.dst));
  const money = internal.map((t) => ({ source: t.src, target: t.dst, kind: 'money' as const, amount: t.amount }));
  const { edges: shared, sharedTargets } = sharedEdges([...ids]);
  const ring: Ring = {
    ringId: `RING-${mule}`,
    nodes: members.map((m) => ({ ...m, isMule: m.id === mule })),
    links: [...money, ...shared],
    mule,
    totalAmount: internal.reduce((s, t) => s + t.amount, 0),
    sharedDevices: sharedTargets,
    internalTx: internal.length,
  };
  const fresh = ring.nodes.filter((n) => n.openedDaysAgo <= 30).length;
  const risk = Math.min(99, 40 + ring.sharedDevices * 8 + fresh * 4 + Math.min(20, ring.internalTx));
  const muleName = ring.nodes.find((n) => n.id === mule)?.name ?? mule;
  const verdict: Verdict = {
    riskScore: risk,
    typology: 'structuring / smurfing',
    narrative: `Detected a ${ring.nodes.length}-account cluster funneling $${ring.totalAmount.toLocaleString()} into a single mule (${muleName}). ${ring.nodes.length - 1} feeder accounts share ${ring.sharedDevices} device/IP fingerprint(s) and were opened within the last 30 days — a classic structuring ring engineered to stay under individual reporting thresholds.`,
    recommendedAction: 'Freeze all feeder accounts and the mule; file SAR; escalate to Tier-2.',
  };
  return { ring, verdict, memory: null };
}

// ------------------------------------------------------------------- public API
export const getStatus = (): Promise<Status> =>
  STATIC ? Promise.resolve({ neo4j: false, rocketride: false, butterbase: false, cognee: false, mode: 'sample-demo' }) : fetch('/api/status').then(j);

export const getInitialGraph = (): Promise<GraphData> => {
  if (!STATIC) return fetch('/api/graph/initial').then(j);
  const nodes = snap.accounts.map((a) => ({ id: a.id, name: a.name, type: 'account', community: -1, betweenness: 0, flagged: a.flagged }));
  const money = snap.tx.slice(0, 260).map((t) => ({ source: t.src, target: t.dst, kind: 'money', amount: t.amount }));
  // Bake the ring's shared-identity + funnel edges into the layout up front so the
  // cluster forms once (stably). On detect we only recolor — never reheat the sim.
  const ringSet = new Set(snap.ring);
  const ringMoney = snap.tx
    .filter((t) => ringSet.has(t.src) && ringSet.has(t.dst))
    .map((t) => ({ source: t.src, target: t.dst, kind: 'money', amount: t.amount }));
  const shared = sharedEdges([...ringSet]).edges;
  return Promise.resolve({ nodes, links: [...money, ...ringMoney, ...shared] });
};

export const detect = (): Promise<DetectResult> => (STATIC ? Promise.resolve(staticDetect()) : liveDetect());

export const listCases = () => (STATIC ? Promise.resolve([]) : fetch('/api/cases').then(j));

export const checkout = (userId: string) => {
  if (STATIC) { staticPaid = true; return Promise.resolve({ url: 'demo://checkout-complete', demo: true }); }
  return fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }).then(j);
};

export async function freeze(userId: string, ring: Ring, verdict: Verdict) {
  if (STATIC) {
    if (!staticPaid) return { status: 402, body: { needsPayment: true, plan: 'pro' } };
    return { status: 200, body: { frozen: ring.nodes.length, case: { id: 'case_1', ringId: ring.ringId, frozen: true } } };
  }
  const r = await fetch('/api/freeze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ring, verdict }),
  });
  return { status: r.status, body: await r.json() };
}

export function streamTransactions(onTx: (tx: { src: string; dst: string; amount: number }) => void) {
  if (STATIC) {
    const timer = setInterval(() => {
      const a = snap.accounts[Math.floor(Math.random() * snap.accounts.length)];
      const b = snap.accounts[Math.floor(Math.random() * snap.accounts.length)];
      if (a.id !== b.id) onTx({ src: a.id, dst: b.id, amount: 5 + Math.floor(Math.random() * 900) });
    }, 650);
    return () => clearInterval(timer);
  }
  const es = new EventSource('/api/stream');
  es.onmessage = (e) => onTx(JSON.parse(e.data));
  return () => es.close();
}
