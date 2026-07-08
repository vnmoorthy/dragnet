import type { MemoryInfo } from './api';

// Cognee cross-session memory — recalled typologies + match score.
export default function CogneeMemory({ memory }: { memory: MemoryInfo }) {
  if (!memory.hit) {
    return (
      <div className="cognee">
        <div className="cog-head"><span className="cog-brain">🧠</span> Cognee memory</div>
        <div className="cog-miss">New typology — will be learned after you confirm.</div>
      </div>
    );
  }
  return (
    <div className="cognee hit">
      <div className="cog-head"><span className="cog-brain">🧠</span> Cognee memory <span className="cog-stored">{memory.storedTypologies} typologies stored</span></div>
      <div className="cog-body">
        <div className="cog-score">
          <span className="cog-num">{memory.matchScore}%</span>
          <span className="cog-lbl">match</span>
        </div>
        <div className="cog-recent">
          <div className="cog-top"><b>{memory.recent[0].caseId}</b> · {memory.recent[0].typology}</div>
          {memory.recent.slice(1).map((r) => (
            <div key={r.caseId} className="cog-row"><span>{r.caseId}</span><span className="cog-typ">{r.typology}</span><span className="cog-conf">{r.confidence}%</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
