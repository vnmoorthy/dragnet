import type { Phase } from './api';

// Cypher inspector — the actual algorithm structure, lit up phase-by-phase.
// Static strings only (zero runtime cost, CSP-safe). Powered by Neo4j.
const STEPS = [
  {
    activeOn: ['scanning'],
    lines: [
      { t: 'kw', v: 'MATCH ' }, { t: 'id', v: '(a)-[:USED_DEVICE|USED_IP]->(x)<-[…]-(b)' },
      { t: 'br', v: '' },
      { t: 'kw', v: 'MERGE ' }, { t: 'id', v: '(a)-[:LINKED]-(b)' },
    ],
    tag: 'link shared identities',
  },
  {
    activeOn: ['traversing'],
    lines: [
      { t: 'kw', v: 'CALL ' }, { t: 'id', v: 'gds.wcc.stream(...)' },
      { t: 'br', v: '' },
      { t: 'kw', v: 'WHERE ' }, { t: 'id', v: 'componentSize' }, { t: 'op', v: ' >= ' }, { t: 'num', v: '4' },
    ],
    tag: 'find connected component',
  },
  {
    activeOn: ['revealing'],
    lines: [
      { t: 'kw', v: 'CALL ' }, { t: 'id', v: 'gds.betweenness.stream(ring)' },
      { t: 'br', v: '' },
      { t: 'kw', v: 'YIELD ' }, { t: 'id', v: 'node, centrality' },
    ],
    tag: 'score centrality',
  },
  {
    activeOn: ['complete'],
    lines: [
      { t: 'kw', v: 'ORDER BY ' }, { t: 'id', v: 'centrality ' }, { t: 'kw', v: 'DESC ' }, { t: 'kw', v: 'LIMIT ' }, { t: 'num', v: '1' },
      { t: 'br', v: '' },
      { t: 'cm', v: '// mule → ' }, { t: 'str', v: 'ACC-RING-8' },
    ],
    tag: 'identify mule',
  },
];

export default function QuerySteps({ phase }: { phase: Phase }) {
  return (
    <div className="bpanel qsteps">
      <div className="bpanel-head">
        <span className="bpanel-title">⌘ CYPHER</span>
        <span className="bpanel-tag">Powered by Neo4j</span>
      </div>
      <div className="qs-blocks">
        {STEPS.map((s, i) => {
          const active = s.activeOn.includes(phase);
          const done = phase !== 'idle' && STEPS.findIndex((x) => x.activeOn.includes(phase)) > i;
          return (
            <div key={i} className={`qs-block ${active ? 'active' : done ? 'done' : ''}`}>
              <div className="qs-num">{i + 1}</div>
              <div className="qs-code">
                <div className="qs-line">
                  {s.lines.map((tok, k) => (tok.t === 'br' ? <br key={k} /> : <span key={k} className={`tok-${tok.t}`}>{tok.v}</span>))}
                </div>
                <div className="qs-tag">{s.tag}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
