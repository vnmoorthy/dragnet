// Intro card shown before detection — frames the scenario + single CTA.
export default function EmptyBriefing({ accounts, onRun, disabled }: {
  accounts: number; onRun: () => void; disabled: boolean;
}) {
  return (
    <div className="empty-briefing">
      <div className="eb-badge">◉ LIVE MONITORING</div>
      <h2 className="eb-title">Coordinated laundering,<br />hidden in plain sight.</h2>
      <p className="eb-body">
        Monitoring <b>{accounts}</b> accounts. Every transfer looks clean in isolation —
        the ring only appears in the <span className="eb-accent">relationships between accounts</span>.
      </p>
      <ul className="eb-points">
        <li><span className="eb-dot n" /> Graph-native detection — Neo4j</li>
        <li><span className="eb-dot r" /> Multi-agent scoring — RocketRide Cloud</li>
        <li><span className="eb-dot c" /> Cross-session memory — Cognee</li>
      </ul>
      <button className="primary" disabled={disabled} onClick={onRun}>⚡ Run ring detection</button>
    </div>
  );
}
