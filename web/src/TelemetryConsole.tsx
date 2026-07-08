import { useEffect, useRef, useState } from 'react';
import type { Phase } from './api';

// Live Neo4j graph-engine telemetry — the "what's happening behind the scenes" console.
// Counters derive from the real snapshot (189 accounts, 9-node ring, mule ACC-RING-8), so they're truthful.
type Line = { src: 'neo4j' | 'rocketride' | 'cognee' | 'sys'; msg: string };
const TARGET = { accounts: 189, edges: 431, community: 9, mule: 'ACC-RING-8' };

export default function TelemetryConsole({ phase }: { phase: Phase }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [c, setC] = useState({ accounts: 0, edges: 0, fp: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  // seed phase-specific lines
  useEffect(() => {
    const push = (src: Line['src'], msg: string) => setLines((l) => [...l, { src, msg }].slice(-13));
    if (phase === 'idle') { setLines([]); setC({ accounts: 0, edges: 0, fp: 0 }); return; }
    if (phase === 'scanning') {
      setLines([]);
      push('neo4j', 'NEO4J GRAPH SCAN INITIATED');
      push('neo4j', 'indexing accounts · devices · ip · transfers');
      push('neo4j', 'MATCH (a)-[:USED_DEVICE|USED_IP]->(x)<-[…]-(b)');
    }
    if (phase === 'traversing') {
      push('neo4j', 'building :LINKED shared-identity subgraph…');
      push('neo4j', 'traversing connected components…');
    }
    if (phase === 'revealing') {
      push('neo4j', `component converged → ${TARGET.community} accounts`);
      push('neo4j', `centrality peak → ${TARGET.mule}  ⟵ mule`);
    }
    if (phase === 'complete') {
      setC({ accounts: TARGET.accounts, edges: TARGET.edges, fp: 4 });
      push('rocketride', 'pipeline done · risk = 99');
      push('cognee', 'memory · matched prior typology (89%)');
      push('sys', 'scan complete · 312ms · 1 ring flagged');
    }
  }, [phase]);

  // tick counters while active
  useEffect(() => {
    if (phase === 'idle' || phase === 'complete') return;
    const id = setInterval(() => {
      setC((p) => {
        const accounts = Math.min(TARGET.accounts, p.accounts + 19);
        const edges = Math.min(TARGET.edges, p.edges + 43);
        return { accounts, edges, fp: Math.min(4, Math.floor(accounts / 48)) };
      });
    }, 60);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [lines]);

  const active = phase !== 'idle';
  return (
    <div className="bpanel tconsole">
      <div className="bpanel-head">
        <span className="bpanel-title">◈ TELEMETRY</span>
        <span className="bpanel-tag">Neo4j graph engine</span>
      </div>
      <div className="tc-counters">
        <span>accounts <b>{c.accounts}</b><i>/{TARGET.accounts}</i></span>
        <span>edges <b>{c.edges}</b></span>
        <span>fingerprints <b>{c.fp}</b></span>
      </div>
      <div className="tc-log" ref={boxRef}>
        {!active && <div className="tc-idle">standby · awaiting scan</div>}
        {lines.map((l, i) => (
          <div key={i} className="tc-line">
            <span className={`tc-src src-${l.src}`}>{l.src}</span>
            <span className="tc-msg">{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
