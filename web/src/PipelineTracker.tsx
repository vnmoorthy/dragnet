import type { CSSProperties } from 'react';
import type { Phase, DetectResult } from './api';

// RocketRide Cloud multi-agent pipeline — mirrors the real nodes in pipeline/dragnet.pipe.json:
// Score (deterministic code) -> Typology (Claude) -> Narrate (GPT-4o).
type StageState = 'pending' | 'active' | 'done';

const STAGES = [
  { key: 'score', label: 'Score', model: 'code', color: '#ffb03b' },
  { key: 'typology', label: 'Typology', model: 'claude-sonnet-5', color: '#35c2ff' },
  { key: 'narrate', label: 'Narrate', model: 'gpt-4o', color: '#3bd67a' },
] as const;

// map the choreography phase -> per-stage state
function stateFor(key: string, phase: Phase): StageState {
  const order = ['score', 'typology', 'narrate'];
  const activeIdx = phase === 'traversing' ? 0 : phase === 'revealing' ? 1 : phase === 'complete' ? 3 : -1;
  const idx = order.indexOf(key);
  if (activeIdx < 0) return 'pending';
  if (idx < activeIdx) return 'done';
  if (idx === activeIdx) return 'active';
  return 'pending';
}

export default function PipelineTracker({ phase, result }: { phase: Phase; result: DetectResult | null }) {
  const output = (key: string): string => {
    if (!result) return '';
    if (key === 'score') return String(result.verdict.riskScore);
    if (key === 'typology') return result.verdict.typology;
    return result.verdict.narrative.slice(0, 68) + '…';
  };

  return (
    <div className="bpanel pipeline">
      <div className="bpanel-head">
        <span className="bpanel-title">▶ PIPELINE</span>
        <span className="bpanel-tag">RocketRide Cloud · multi-agent</span>
      </div>
      <div className="pipe-stages">
        {STAGES.map((s) => {
          const st = stateFor(s.key, phase);
          return (
            <div key={s.key} className={`pipe-stage ${st}`} style={{ '--sc': s.color } as CSSProperties}>
              <div className="pipe-top">
                <span className="pipe-dot" />
                <span className="pipe-label">{s.label}</span>
                <span className="pipe-model">{s.model}</span>
              </div>
              <div className="pipe-bar"><span style={{ width: st === 'done' ? '100%' : st === 'active' ? '65%' : '0%' }} /></div>
              <div className="pipe-out">{st === 'done' && result ? output(s.key) : st === 'active' ? 'running…' : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
