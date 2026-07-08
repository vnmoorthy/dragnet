import type { RiskFactor } from './api';

// Structured, iconographic risk atoms — the "why is this a 99" evidence row.
export default function RiskFactors({ factors }: { factors: RiskFactor[] }) {
  return (
    <div className="risk-factors">
      {factors.map((f, i) => (
        <span key={i} className={`rf sev-${f.severity}`}>
          {f.label}<b>+{f.weight}</b>
        </span>
      ))}
    </div>
  );
}
