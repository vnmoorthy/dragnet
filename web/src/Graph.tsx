import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData } from './api';

type Props = {
  data: GraphData;
  ringIds: Set<string>;
  muleId: string | null;
  detected: boolean;
};

const STEEL = '#5b83a8';
const RING = '#ff3b57';
const MULE = '#ffd23b';

export default function Graph({ data, ringIds, muleId, detected }: Props) {
  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // size the canvas to its container (react-force-graph defaults to window size)
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
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-38);
  }, []);

  // Reveal: focus the (stable) ring cluster. No data changed on detect, so node
  // positions are settled — the centroid is accurate and the camera lands on it.
  useEffect(() => {
    if (!detected || !fgRef.current || !ringIds.size) return;
    const t = setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      const ring = data.nodes.filter((n: any) => ringIds.has(n.id) && Number.isFinite(n.x));
      if (!ring.length) return;
      const cx = ring.reduce((s: number, n: any) => s + n.x, 0) / ring.length;
      const cy = ring.reduce((s: number, n: any) => s + n.y, 0) / ring.length;
      fg.centerAt(cx, cy, 900);
      fg.zoom(2.4, 900);
    }, 450);
    return () => clearTimeout(t);
  }, [detected, ringIds, data.nodes]);

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
        linkColor={(l: any) => {
          if (l.kind === 'shared') return detected ? 'rgba(255,59,87,0.95)' : 'rgba(255,90,110,0.10)';
          if (detected && inRing(l)) return 'rgba(255,150,60,0.9)';
          return detected ? 'rgba(120,140,160,0.05)' : 'rgba(120,150,180,0.16)';
        }}
        linkWidth={(l: any) => (l.kind === 'shared' ? (detected ? 2.5 : 1) : detected && inRing(l) ? 1.6 : 0.7)}
        linkLineDash={(l: any) => (l.kind === 'shared' ? [5, 3] : null)}
        linkDirectionalParticles={(l: any) => (detected && inRing(l) && l.kind === 'money' ? 4 : 0)}
        linkDirectionalParticleWidth={2.6}
        linkDirectionalParticleColor={() => MULE}
        nodeCanvasObject={(node: any, ctx, scale) => {
          const isMule = node.id === muleId;
          const isRing = ringIds.has(node.id);
          // pulsing mule when detected
          const pulse = isMule && detected ? 1 + 0.22 * Math.sin(performance.now() / 260) : 1;
          const r = isMule ? 10 * pulse : isRing ? 6.5 : detected ? 2 : 4;

          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          if (isMule) {
            ctx.shadowColor = MULE; ctx.shadowBlur = 26;
            ctx.fillStyle = MULE;
          } else if (isRing) {
            ctx.shadowColor = RING; ctx.shadowBlur = 18;
            ctx.fillStyle = RING;
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = detected ? 'rgba(80,100,120,0.4)' : STEEL;
          }
          ctx.fill();
          ctx.shadowBlur = 0;

          if (isRing || isMule) {
            ctx.strokeStyle = isMule ? '#fff4c2' : '#ffb3c0';
            ctx.lineWidth = 1.6 / scale;
            ctx.stroke();
            if (scale > 1.0) {
              ctx.font = `${(isMule ? 6.5 : 5) }px Inter, sans-serif`;
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
