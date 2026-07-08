import { useEffect, useMemo, useRef, useState } from 'react';
import Graph from './Graph';
import TelemetryConsole from './TelemetryConsole';
import PipelineTracker from './PipelineTracker';
import QuerySteps from './QuerySteps';
import RiskFactors from './RiskFactors';
import CogneeMemory from './CogneeMemory';
import { useCounter } from './useCounter';
import {
  detect, getInitialGraph, getStatus, streamTransactions, freeze, checkout,
  type GraphData, type DetectResult, type Status, type Phase, type Breakdown,
} from './api';

const USER = 'investigator-demo';

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [result, setResult] = useState<DetectResult | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [feed, setFeed] = useState<string[]>([]);
  const [paywall, setPaywall] = useState(false);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const timers = useRef<number[]>([]);

  const busy = phase === 'scanning' || phase === 'traversing' || phase === 'revealing';

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

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const ringIds = useMemo(() => new Set(result?.ring.nodes.map((n) => n.id) ?? []), [result]);

  async function runDetect() {
    if (busy) return;
    const r = await detect(); // resolve first so the ring is ready by the reveal beat
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    setPhase('scanning');
    at(800, () => setPhase('traversing'));
    at(1500, () => { setResult(r); setPhase('revealing'); }); // graph lights up + camera moves
    at(2200, () => setPhase('complete'));                     // briefing fades in
  }

  function resetDemo() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setResult(null); setFrozen(null); setPaywall(false); setPaying(false);
    setPhase('idle');
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
    await checkout(USER);
    const res = await freeze(USER, result.ring, result.verdict);
    setPaying(false);
    setPaywall(false);
    if (res.status !== 402) setFrozen(res.body.frozen);
  }

  const muleName = result?.ring.nodes.find((n) => n.isMule)?.name ?? result?.ring.mule;
  const busyLabel = phase === 'scanning' ? '⚙ Scanning graph…' : phase === 'traversing' ? '⚙ Linking shared identities…' : '⚙ Pinpointing mule…';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">🕸️</span> DRAGNET <span className="tag">real-time fraud-ring intelligence</span></div>
        <div className="topbar-right">
          <div className="chips">
            <Chip on={status?.neo4j} label="Neo4j" demoLabel="Neo4j" />
            <Chip on={status?.rocketride} label="RocketRide" demoLabel="RocketRide" />
            <Chip on={status?.butterbase} label="Butterbase" demoLabel="Butterbase" />
            <Chip on={status?.cognee} label="Cognee" demoLabel="Cognee" />
          </div>
          {phase !== 'idle' && <button className="reset" onClick={resetDemo}>↺ Reset</button>}
        </div>
      </header>

      <div className="stage">
        <div className="canvas">
          <Graph data={graph} ringIds={ringIds} muleId={result?.ring.mule ?? null} phase={phase} />
          {phase === 'idle' && (
            <div className="hint">{graph.nodes.length} accounts · every transaction looks clean in isolation</div>
          )}
          {(phase === 'scanning' || phase === 'traversing') && (
            <div className="scanning"><span className="spin">⚙</span> {phase === 'scanning' ? 'Scanning transaction graph…' : 'Traversing shared-identity links…'}</div>
          )}
          {(phase === 'revealing' || phase === 'complete') && result && (
            <div className="detected-banner">
              ⚠ FRAUD RING DETECTED · {result.ring.nodes.length} accounts · mule&nbsp;<b>{muleName}</b>
            </div>
          )}
        </div>

        <aside className="panel">
          <section className="feed">
            <h3>◉ Live transaction feed</h3>
            <ul>{feed.map((l, i) => <li key={i} style={{ opacity: 1 - i * 0.12 }}>{l}</li>)}</ul>
          </section>

          {phase !== 'complete' ? (
            <button className="primary" disabled={busy || !graph.nodes.length} onClick={runDetect}>
              {busy ? busyLabel : '⚡ Run ring detection'}
            </button>
          ) : result && (
            <section className="briefing">
              <div className="scorewrap">
                <RiskDial score={result.verdict.riskScore} breakdown={result.verdict.breakdown} />
                <div>
                  <div className="typology">{result.verdict.typology}</div>
                  <div className="ringmeta">
                    <AnimatedMetric value={result.ring.nodes.length} /> accounts · $<AnimatedMetric value={result.ring.totalAmount} /> · <AnimatedMetric value={result.ring.sharedDevices} /> shared fingerprints
                  </div>
                </div>
              </div>

              <RiskFactors factors={result.verdict.riskFactors} />

              <p className="narrative">{result.verdict.narrative}</p>

              <CogneeMemory memory={result.memory} />

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

      <div className="console">
        <TelemetryConsole phase={phase} />
        <QuerySteps phase={phase} />
        <PipelineTracker phase={phase} result={result} />
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

function Chip({ on, label }: { on?: boolean; label: string; demoLabel?: string }) {
  return <span className={`chip ${on ? 'live' : 'demo'}`}>{on ? '● ' : '○ '}{label}</span>;
}

function AnimatedMetric({ value }: { value: number }) {
  const n = useCounter(value, 700);
  return <>{Math.round(n).toLocaleString()}</>;
}

function RiskDial({ score, breakdown }: { score: number; breakdown: Breakdown }) {
  const n = Math.round(useCounter(score, 700));
  const color = score >= 80 ? '#ff3b57' : score >= 50 ? '#ffb03b' : '#3bd67a';
  const tier = score >= 80 ? 'CRITICAL' : score >= 50 ? 'HIGH' : 'MEDIUM';
  return (
    <div className="dialwrap">
      <div className={`dial ${score >= 80 ? 'crit' : ''}`} style={{ borderColor: color, color }}>
        <span className="num">{n}</span><span className="lbl">RISK</span>
      </div>
      <span className="tier" style={{ color }}>{tier}</span>
      <div className="factbars">
        <FactBar label="DEV" v={breakdown.devices} c="#ff3b57" />
        <FactBar label="AGE" v={breakdown.recency} c="#ffb03b" />
        <FactBar label="VOL" v={breakdown.volume} c="#3bd67a" />
      </div>
    </div>
  );
}

function FactBar({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div className="factbar">
      <span className="fb-label">{label}</span>
      <span className="fb-track"><span className="fb-fill" style={{ width: `${v}%`, background: c }} /></span>
    </div>
  );
}
