# 🕸️ Dragnet — Real-Time Fraud-Ring Buster

**HackwithBay 3.0 · Track 2 (Fraud & Anomaly Ring Detector)**

A stream of bank transactions that each look perfectly clean in isolation. Dragnet
runs **Neo4j graph community detection** to make an invisible laundering ring
snap into view, has a **deployed RocketRide Cloud pipeline** score and narrate it,
remembers confirmed typologies with **Cognee**, and runs the whole product —
auth, case database, and the **live payment** to unlock freezing — on **Butterbase**.

> The wow: individually, nothing is suspicious. One click, and the graph lights up
> a 9-account ring funneling **$94,896** into a single mule that no SQL query could
> have surfaced.

---

## Why this wins the rubric

The one stated judging axis is *"how meaningfully all three mandatory technologies
are woven into the core product experience."* In Dragnet, remove any one and the
product collapses:

| Sponsor | What it does here | Why it's load-bearing (not bolted on) |
|---|---|---|
| **Neo4j** | Multi-hop **shared-identity traversal** builds a `LINKED` graph; the ring is its connected component; the mule is the top node by internal received volume | This *is* the detection. The 2-hop `(a)-[:USED_DEVICE\|USED_IP]->(x)<-[...]-(b)` pattern + connected-component traversal are exactly what a SQL `JOIN` can't express cleanly. *(Optional GDS upgrade — Louvain + betweenness — noted below.)* |
| **RocketRide Cloud** | Deployed multi-agent pipeline: **Score → Typology → Narrate** (`pipeline/dragnet.pipe.json`) | The app calls the hosted endpoint to turn a raw subgraph into an investigator briefing + risk score. Runs in production, not local. |
| **Butterbase** | **Auth** (investigator login) · **DB** (cases table) · **Payment** (Stripe Connect paywall to freeze/export) | All three required Butterbase capabilities are exercised in one flow — the paywall is a *natural* moment, not a forced checkout. |
| **Cognee** 🎁 | Memory of confirmed ring **typologies** across sessions | On re-detection it says *"Matches a ring you confirmed before"* — the agent gets smarter over time. Bonus track. |

**Bulletproof demo:** every sponsor call has a demo-mode fallback (see below), so a
flaky conference network can never break your presentation.

---

## Architecture

```
                 ┌──────────────── web (Vite + React) ────────────────┐
                 │  force-directed graph · live feed · briefing card   │
                 │  paywall modal                                      │
                 └───────────────┬─────────────────────────────────────┘
                                 │  /api/*  (proxy :5173 → :8787)
                 ┌───────────────▼──── src/server.ts (orchestrator) ───┐
                 │  /detect   /freeze   /checkout   /stream   /cases    │
                 └──┬───────────┬───────────┬───────────────┬──────────┘
                    │           │           │               │
              Neo4j Aura   RocketRide    Butterbase       Cognee
              (Cypher:       Cloud       (auth + cases    sidecar
               shared-ID      pipeline    + Stripe pay)   (memory)
               traversal)
```

- **`src/data/generate.ts`** — seeds a 189-account graph with one planted ring, and
  dumps `demo-graph.json` so the UI runs with zero live services.
- **`src/data/queries.ts`** — every Cypher/GDS query (the graph-native logic).
- **`src/server.ts`** — wires all four sponsors into one request flow.
- **`pipeline/dragnet.pipe.json`** — the RocketRide pipeline to build & deploy.
- **`web/`** — the presentation layer (the wow).

---

## Quickstart

### 1. Demo mode (works right now, no keys)
```bash
npm install
npm run seed:json          # writes the demo snapshot
npm run dev                # server (:8787) + web (:5173)
# open http://localhost:5173
```
Everything works off the seeded snapshot — detection, narration, memory, paywall.

### 2. Go live (you already have the accounts)
Copy `.env.example` → `.env` and fill in:

- **Neo4j Aura** → ✅ **already wired, seeded, and verified.** Detection runs
  **native Cypher** shared-identity traversal (no GDS session required), so it
  works on a stock Aura instance. *Optional GDS upgrade:* to pitch Louvain +
  betweenness, provision Aura Graph Analytics (serverless GDS session) or run
  Neo4j locally in Docker with the GDS plugin, then swap `RING_CANDIDATES` for the
  `gds.louvain`/`gds.betweenness` calls.
- **RocketRide** → open `pipeline/dragnet.pipe.json` in the RocketRide VS Code
  extension, wire the nodes on the canvas, run locally, **one-click deploy** to
  `cloud.rocketride.ai`, then set `ROCKETRIDE_ENDPOINT` (+ `ROCKETRIDE_API_KEY`).
- **Butterbase** → set `BUTTERBASE_API_URL` + `BUTTERBASE_API_KEY` (redeem promo
  `ENJOY0707` in billing first). Create a `cases` table and a `pro` plan in the
  dashboard. Auth, case writes, and the Stripe-Connect checkout go live.
- **Cognee** (bonus) → `pip install cognee fastapi uvicorn`, point it at your Neo4j
  (see `cognee_service.py` header), run `uvicorn cognee_service:app --port 8000`,
  set `COGNEE_URL=http://localhost:8000`.

The status chips in the header turn green as each live service comes online.

> **Verify each integration before the demo** — the exact Butterbase/RocketRide
> endpoint paths in `src/lib/*.ts` follow their docs but confirm them against your
> dashboard. Each module is isolated and falls back to demo mode if a call fails.

---

## 🎤 Demo script (90 seconds — rehearse this)

1. **Set the trap (10s).** "This is a live bank feed. 189 accounts. Watch the feed —
   every transaction is small, normal, individually invisible to any rules engine."
   *(Graph drifts; feed ticks.)*
2. **The reveal (15s).** Click **⚡ Run ring detection**. "Neo4j just traversed the
   whole graph — linking every account that shares a device or IP, then isolating
   the one connected cluster that lights up." *(Camera
   flies to the ring; 8 red feeder nodes + the gold mule; dashed red lines show the
   shared devices; orange particles animate the money funneling to the mule.)*
3. **The intelligence (25s).** "Our RocketRide Cloud pipeline scored it **99**,
   classified it as **structuring / smurfing**, and wrote this briefing:
   *9 accounts funneling $94,896 into one mule, sharing just 4 device fingerprints,
   all opened in the last 30 days.*"
4. **The memory (10s).** "And Cognee recognizes it — *we've confirmed this typology
   before.*" *(🧠 Memory hit chip.)*
5. **The business (20s).** Click **🧊 Freeze ring & export case**. *(Butterbase
   paywall.)* "Freezing is a Pro action — the investigator subscribes through
   Butterbase billing…" click **Subscribe** → "…case frozen, saved to our Butterbase
   database, and Cognee just remembered this ring for next time." *(✅ frozen.)*
6. **Land it (10s).** "Four sponsors, one flow: Neo4j finds what SQL can't,
   RocketRide reasons about it in production, Butterbase runs the business including
   the payment, and Cognee makes it smarter every case."

**Reset between runs:** `rm -f src/data/cognee-memory.json` so the first detection
shows *"New typology"* and the memory hit only appears *after* you freeze once.

---

## ⏱️ Solo half-day build plan (you are here)

| Time | Milestone | Status |
|---|---|---|
| 0:00–0:30 | Scaffold + demo mode running end-to-end | ✅ **done (this repo)** |
| 0:30–1:30 | Neo4j Aura wired, seeded, live Cypher detection verified | ✅ **done** |
| 1:30–3:00 | Build `dragnet.pipe.json` in RocketRide, deploy to Cloud, wire endpoint | ← start here |
| 3:00–4:30 | Butterbase: `cases` table + `pro` plan; confirm auth + real Stripe checkout | |
| 4:30–5:30 | Cognee sidecar against Neo4j (bonus) | |
| 5:30–7:00 | Polish the graph reveal, tune colors/particles, widen for projector | |
| 7:00–8:00 | **Rehearse the 90s script 3×**; record a backup screen capture | |

The scaffold already gives you a working, presentable product in **demo mode** —
so even if a live integration fights you, you always have something to show.

## Submit
Paste into your agent: `Submit my project to the hackathon. Submission code: ENJOY0707 Hackathon slug: HackwithBay-0707`
