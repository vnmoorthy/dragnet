import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData, Phase } from './api';

type Props = {
  data: GraphData;
  ringIds: Set<string>;
  muleId: string | null;
  phase: Phase;
  onNodeClick?: (id: string) => void;
};

const STEEL = '#5b83a8';
const RING = '#ff3b57';
const MULE = '#ffd23b';
const CYAN = '#35c2ff';

export default function Graph({ data, ringIds, muleId, phase, onNodeClick }: Props) {
  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const traversing = phase === 'traversing';
  const revealed = phase === 'revealing' || phase === 'complete';

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    fgRef.current?.d3Force('charge')?.strength(-38);
  }, []);

  // Camera is driven by the choreography phase (each move also forces a canvas repaint).
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (phase === 'traversing') {
      const z = fg.zoom();
      fg.zoom(z * 1.12, 350); // slight focus-in while "linking" — repaints so cyan edges show
    }
    if (phase === 'revealing' && ringIds.size) {
      const t = setTimeout(() => {
        const ring = data.nodes.filter((n: any) => ringIds.has(n.id) && Number.isFinite(n.x));
        if (!ring.length) return;
        const cx = ring.reduce((s: number, n: any) => s + n.x, 0) / ring.length;
        const cy = ring.reduce((s: number, n: any) => s + n.y, 0) / ring.length;
        fg.centerAt(cx, cy, 900);
        fg.zoom(2.6, 900);
      }, 60);
      return () => clearTimeout(t);
    }
    if (phase === 'idle') fg.zoomToFit(600, 40); // reframe whole network on reset/replay
  }, [phase, ringIds, data.nodes]);

  const idOf = (x: any) => (typeof x === 'object' ? x.id : x);
  const inRing = (l: any) => ringIds.has(idOf(l.source)) && ringIds.has(idOf(l.target));

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={data}
        backgroundColor="#0b0f14"
        cooldownTicks={140}
        nodeRelSize={5}
        onEngineStop={() => { if (phase === 'idle') fgRef.current?.zoomToFit(500, 60); }}
        onNodeClick={(n: any) => onNodeClick?.(n.id)}
        linkColor={(l: any) => {
          if (l.kind === 'shared') {
            if (revealed) return 'rgba(255,59,87,0.95)';
            if (traversing) return 'rgba(53,194,255,0.85)';
            return 'rgba(255,90,110,0.10)';
          }
          if (inRing(l)) {
            if (revealed) return 'rgba(255,150,60,0.9)';
            if (traversing) return 'rgba(53,194,255,0.7)';
          }
          return revealed ? 'rgba(120,140,160,0.05)' : 'rgba(120,150,180,0.16)';
        }}
        linkWidth={(l: any) => (l.kind === 'shared' ? (revealed || traversing ? 2.4 : 1) : (revealed || traversing) && inRing(l) ? 1.6 : 0.7)}
        linkLineDash={(l: any) => (l.kind === 'shared' ? [5, 3] : null)}
        linkDirectionalParticles={(l: any) => (revealed && inRing(l) && l.kind === 'money' ? 4 : 0)}
        linkDirectionalParticleWidth={2.6}
        linkDirectionalParticleColor={() => MULE}
        nodeCanvasObject={(node: any, ctx, scale) => {
          const isMule = node.id === muleId;
          const isRing = ringIds.has(node.id);
          const litRing = isRing && revealed;
          const pulse = isMule && revealed ? 1 + 0.22 * Math.sin(performance.now() / 260) : 1;
          const r = isMule && revealed ? 10 * pulse : litRing ? 6.5 : revealed ? 2 : traversing && isRing ? 5 : 4;

          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          if (isMule && revealed) {
            ctx.shadowColor = MULE; ctx.shadowBlur = 26; ctx.fillStyle = MULE;
          } else if (litRing) {
            ctx.shadowColor = RING; ctx.shadowBlur = 18; ctx.fillStyle = RING;
          } else if (traversing && isRing) {
            ctx.shadowColor = CYAN; ctx.shadowBlur = 12; ctx.fillStyle = CYAN;
          } else {
            ctx.shadowBlur = 0; ctx.fillStyle = revealed ? 'rgba(80,100,120,0.4)' : STEEL;
          }
          ctx.fill();
          ctx.shadowBlur = 0;

          if (litRing || (isMule && revealed)) {
            ctx.strokeStyle = isMule ? '#fff4c2' : '#ffb3c0';
            ctx.lineWidth = 1.6 / scale;
            ctx.stroke();
            if (scale > 1.0) {
              ctx.font = `${isMule ? 6.5 : 5}px Inter, sans-serif`;
              ctx.fillStyle = '#eef4fb';
              ctx.textAlign = 'center';
              ctx.fillText(isMule ? `🎯 ${node.name}` : node.name, node.x, node.y - r - 2.5);
            }
          }
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.id === muleId ? 11 : 6, 0, 2 * Math.PI);
          ctx.fill();
        }}
      />
    </div>
  );
}
