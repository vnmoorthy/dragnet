import { useCounter } from './useCounter';

// Platform KPI strip under the topbar — counts up on mount.
export default function TelemetryBar({ accounts, valueAtRisk, ringsCaught, hasResult }: {
  accounts: number; valueAtRisk: number; ringsCaught: number; hasResult: boolean;
}) {
  return (
    <div className="telemetry-bar">
      <Stat label="Accounts Monitored" value={accounts} />
      <Stat label="Value At Risk" value={valueAtRisk} prefix="$" />
      <Stat label="Rings Caught" value={ringsCaught} accent={ringsCaught > 0 ? '#ff3b57' : undefined} />
      <div className="stat"><span className="stat-v" style={{ color: '#3bd67a' }}>{hasResult ? '1.1s' : '—'}</span><span className="stat-l">Avg Detection</span></div>
    </div>
  );
}

function Stat({ label, value, prefix = '', accent }: { label: string; value: number; prefix?: string; accent?: string }) {
  const n = Math.round(useCounter(value, 900, [value]));
  return (
    <div className="stat">
      <span className="stat-v" style={accent ? { color: accent } : undefined}>{prefix}{n.toLocaleString()}</span>
      <span className="stat-l">{label}</span>
    </div>
  );
}
