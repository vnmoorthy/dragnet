// Presenter aid — a toggleable, off-by-default overlay with the demo script.
// Off by default so it never clutters; the "?" in the topbar opens it.
const STEPS = [
  { t: 'The trap', d: '189 accounts, hundreds of small transfers. Each looks clean — no rules engine flags it.' },
  { t: 'Run detection', d: 'Neo4j links accounts by shared device/IP, finds the connected component, scores centrality.' },
  { t: 'The reveal', d: 'A 9-account ring lights up — 8 feeders funneling into one mule (Sana Shah).' },
  { t: 'The pipeline', d: 'RocketRide Score→Typology→Narrate; Cognee recalls a matching prior case.' },
  { t: 'Act on it', d: 'Freeze the ring → Butterbase Stripe paywall → case saved. Reset to replay.' },
];

export default function DemoGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="guide">
      <div className="guide-head"><span>▶ Demo script</span><button className="guide-close" onClick={onClose}>✕</button></div>
      <ol className="guide-steps">
        {STEPS.map((s, i) => (
          <li key={i}><span className="guide-n">{i + 1}</span><div><b>{s.t}</b><span>{s.d}</span></div></li>
        ))}
      </ol>
    </div>
  );
}
