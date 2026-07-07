/**
 * Butterbase = your product backend. THREE things must be actively used for the
 * hackathon: (1) database, (2) auth, (3) payment. All three are exercised below.
 *
 * We talk to Butterbase over its documented REST surface (auto CRUD Data API,
 * Auth API, Stripe-Connect billing). Swap to the `butterbase` TS SDK
 * later if you prefer — the shapes match.
 *
 * Every call degrades to an in-memory demo so the presentation never hard-fails.
 */
// Butterbase REST is namespaced by app_id:  https://api.butterbase.ai/v1/{app_id}/...
// Auth header: Bearer {api_key} = service role.  (See docs.butterbase.ai/api-reference.)
const BASE = process.env.BUTTERBASE_API_URL || 'https://api.butterbase.ai';
const KEY = process.env.BUTTERBASE_API_KEY || '';
const APP_ID = process.env.BUTTERBASE_APP_ID || '';
const PRO_PLAN = process.env.BUTTERBASE_PRO_PLAN_ID || 'pro';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
// Gated on APP_ID too: without it we stay in the safe demo fallback rather than
// firing requests at an unknown app namespace.
export const hasButterbase = () => Boolean(KEY && APP_ID);

async function bb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}/v1/${APP_ID}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Butterbase ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// ---- (1) AUTH -------------------------------------------------------------
export async function login(email: string, password: string) {
  if (!hasButterbase()) return { token: 'demo-token', user: { email, id: 'demo-user' } };
  // Auth API: POST /v1/{app_id}/auth/login -> { token, user }  (confirm path in dashboard)
  return bb('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

// ---- (2) DATABASE (cases table via Data API auto-CRUD) --------------------
const demoCases: any[] = [];
export async function saveCase(c: {
  ringId: string; accounts: string[]; mule: string; amount: number; score: number; narrative: string; frozen: boolean;
}) {
  if (!hasButterbase()) { const row = { id: `case_${demoCases.length + 1}`, ...c, createdAt: Date.now() }; demoCases.push(row); return row; }
  // Data API: POST /v1/{app_id}/cases
  return bb('/cases', { method: 'POST', body: JSON.stringify(c) });
}

export async function listCases() {
  if (!hasButterbase()) return demoCases;
  // Data API: GET /v1/{app_id}/cases?order=createdAt.desc
  return bb('/cases?order=createdAt.desc');
}

// ---- (3) PAYMENT (Stripe Connect subscription = the live demo moment) -----
// Freezing/exporting a case is a Pro action. Free tier hits a paywall; the
// investigator subscribes via Butterbase billing, then the action unlocks.
const paidUsers = new Set<string>();
export async function isPro(userId: string) {
  if (!hasButterbase()) return paidUsers.has(userId);
  // Billing API: GET /v1/{app_id}/billing/subscription -> { status, plan }
  const r = await bb('/billing/subscription');
  return r?.status === 'active' || r?.plan === PRO_PLAN;
}

export async function createCheckout(userId: string, _plan = PRO_PLAN) {
  if (!hasButterbase()) { paidUsers.add(userId); return { url: 'demo://checkout-complete', demo: true }; }
  // Billing API: POST /v1/{app_id}/billing/subscribe -> { url } (hosted Stripe Connect checkout)
  return bb('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ planId: PRO_PLAN, successUrl: `${APP_URL}?paid=1`, cancelUrl: APP_URL }),
  });
}
