# Dragnet — Demo Script

**Live:** https://vnmoorthy.github.io/dragnet/ · **Deck:** /deck.html · **Repo:** github.com/vnmoorthy/dragnet

Runs fully client-side (no backend / no network) — safe on any Wi-Fi. The in-app
**? Guide** button (top-right) shows this script; **Reset** replays; **Esc** closes any panel.

## 90-second flow

1. **The trap (10s)** — Point at the KPI bar (189 accounts monitored, $2.2M at risk) and the
   live feed. *"Every transfer looks clean in isolation. A rules engine sees nothing."*

2. **Run detection (5s)** — Click **⚡ Run ring detection**. Let the ~2s sequence breathe.

3. **Behind the scenes (20s)** — Narrate the bottom console as it streams:
   *"Neo4j is linking accounts by shared device and IP, finding the connected component,
   scoring centrality — there's the mule, ACC-RING-8."* Point to the **Cypher** panel lighting
   up step-by-step and the **RocketRide pipeline** (Score → Typology → Narrate).

4. **The reveal (15s)** — The ring lights up: 8 red feeders + the gold mule **Sana Shah**,
   red dashed shared-device links, money funneling in. *"A pattern SQL can't express."*

5. **The briefing (15s)** — Risk dial counts to **99 CRITICAL**; read the risk-factor pills and
   the **Cognee memory** panel: *"89% match to a case we've confirmed before."*

6. **Act on it (15s)** — Click **🧊 Freeze ring & export case** → the **Butterbase** Pro paywall →
   **Subscribe** → case frozen, Case ID generated, saved to Butterbase.

7. **Close (10s)** — *"Neo4j finds what SQL can't, RocketRide reasons in production, Butterbase
   runs the business including payment, Cognee makes it smarter every case."* Hit **Reset** to replay.

## Tips
- Optional: click any account node to open the **inspect drawer** (devices, IPs, ring membership).
- The demo loops indefinitely via **Reset** — no page reload needed.
- On a projector (≥1920px) the UI auto-scales larger with brighter text.
