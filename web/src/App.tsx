import { useEffect, useMemo, useState } from 'react';
import Graph from './Graph';
import {
  detect, getInitialGraph, getStatus, streamTransactions, freeze, checkout,
  type GraphData, type DetectResult, type Status,
} from './api';

const USER = 'investigator-demo';

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [result, setResult] = useState<DetectResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [feed, setFeed] = useState<string[]>([]);
  const [paywall, setPaywall] = useState(false);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    graph.nodes.forEach((n) => m.set(n.id, n.name));
    return m;
  }, [graph.nodes]);

  useEffect(() => { getStatus().then(setStatus); getInitialGraph().then(setGraph); }, []);

  useEffect(() => {
    if (!graph.nodes.length) return;
    return streamTransactions((tx) => {
      const line = `${nameMap.get(tx.src) ?? tx.src}  →  ${nameMap.get(tx.dst) ?? tx.dst}   $${tx.amount}`;
      setFeed((f) => [line, ...f].slice(0, 7));
    });
  }, [graph.nodes.length, nameMap]);

  const ringIds = useMemo(() => new Set(result?.ring.nodes.map((n) => n.id) ?? []), [result]);

  async function runDetect() {
    setDetecting(true);
    try {
      // min ~1.1s so the graph traversal reads as real work on screen.
      // NOTE: we do NOT mutate graph data here — the ring edges are already in the
      // layout, so detection just recolors + focuses (no simulation reheat).
      const [r] = await Promise.all([detect(), new Promise((res) => setTimeout(res, 1100))]);
      setResult(r);
    } finally {
      setDetecting(false);
    }
  }

  async function onFreeze() {
    if (!result) return;
    const res = await freeze(USER, result.ring, result.verdict);
    if (res.status === 402) { setPaywall(true); return; }
    setFrozen(res.body.frozen);
  }

  async function onPay() {
    if (!result) return;
    setPaying(true);
    await checkout(USER);                       // Butterbase Stripe Connect checkout
    const res = await freeze(USER, result.ring, result.verdict); // retry, now Pro
    setPaying(false);
    setPaywall(false);
    if (res.status !== 402) setFrozen(res.body.frozen);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">🕸️</span> DRAGNET <span className="tag">real-time fraud-ring intelligence</span></div>
        <div className="chips">
          <Chip on={status?.neo4j} label="Neo4j" demoLabel="Neo4j (demo)" />
          <Chip on={status?.rocketride} label="RocketRide" demoLabel="RocketRide (demo)" />
          <Chip on={status?.butterbase} label="Butterbase" demoLabel="Butterbase (demo)" />
          <Chip on={status?.cognee} label="Cognee" demoLabel="Cognee (local)" />
        </div>
      </header>

      <div className="stage">
        <div className="canvas">
          <Graph data={graph} ringIds={ringIds} muleId={result?.ring.mule ?? null} detected={!!result} />
          {!result && !detecting && (
            <div className="hint">
              {graph.nodes.length} accounts · every transaction looks clean in isolation
            </div>
          )}
          {detecting && (
            <div className="scanning">
              <span className="spin">⚙</span> Traversing the graph — linking accounts by shared device &amp; IP…
            </div>
          )}
          {result && (
            <div className="detected-banner">
              ⚠ FRAUD RING DETECTED · {result.ring.nodes.length} accounts · mule&nbsp;
              <b>{result.ring.nodes.find((n) => n.isMule)?.name ?? result.ring.mule}</b>
            </div>
          )}
        </div>

        <aside className="panel">
          <section className="feed">
            <h3>◉ Live transaction feed</h3>
            <ul>{feed.map((l, i) => <li key={i} style={{ opacity: 1 - i * 0.12 }}>{l}</li>)}</ul>
          </section>

          {!result ? (
            <button className="primary" disabled={detecting || !graph.nodes.length} onClick={runDetect}>
              {detecting ? '⚙ Traversing graph…' : '⚡ Run ring detection'}
            </button>
          ) : (
            <section className="briefing">
              <div className="scorewrap">
                <RiskDial score={result.verdict.riskScore} />
                <div>
                  <div className="typology">{result.verdict.typology}</div>
                  <div className="ringmeta">
                    {result.ring.nodes.length} accounts · ${result.ring.totalAmount.toLocaleString()} ·
                    {' '}{result.ring.sharedDevices} shared fingerprints
                  </div>
                </div>
              </div>

              <p className="narrative">{result.verdict.narrative}</p>

              <div className="memory">
                🧠 {result.memory ? <><b>Memory hit:</b> {result.memory}</> : <>New typology — will be remembered after you confirm.</>}
              </div>

              <div className="action">{result.verdict.recommendedAction}</div>

              {frozen == null ? (
                <button className="danger" onClick={onFreeze}>🧊 Freeze ring &amp; export case</button>
              ) : (
                <div className="frozen">✅ {frozen} accounts frozen · case saved to Butterbase</div>
              )}
            </section>
          )}
        </aside>
      </div>

      {paywall && (
        <div className="modal-bg" onClick={() => setPaywall(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Dragnet Pro</h2>
            <p>Freezing accounts and exporting case files is a Pro capability.</p>
            <div className="price">$49<span>/investigator/mo</span></div>
            <ul className="perks">
              <li>Freeze &amp; export unlimited cases</li>
              <li>SAR auto-drafting</li>
              <li>Cross-session ring memory</li>
            </ul>
            <button className="primary" disabled={paying} onClick={onPay}>
              {paying ? 'Processing…' : 'Subscribe with Butterbase →'}
            </button>
            <div className="secure">🔒 Secured by Butterbase billing (Stripe Connect)</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ on, label, demoLabel }: { on?: boolean; label: string; demoLabel: string }) {
  return <span className={`chip ${on ? 'live' : 'demo'}`}>{on ? '● ' + label : '○ ' + demoLabel}</span>;
}

function RiskDial({ score }: { score: number }) {
  const color = score >= 80 ? '#ff3b57' : score >= 50 ? '#ffb03b' : '#3bd67a';
  return (
    <div className="dial" style={{ borderColor: color, color }}>
      <span className="num">{score}</span><span className="lbl">RISK</span>
    </div>
  );
}
