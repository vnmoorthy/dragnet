import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData } from './api';

type Props = {
  data: GraphData;
  ringIds: Set<string>;
  muleId: string | null;
  detected: boolean;
};

const STEEL = '#3b4a5a';
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

  // gentle repulsion so the graph breathes; tighten the ring on detect
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-42);
  }, []);

  // when a ring is found, fly the camera to it — the theatrical "gotcha" moment
  useEffect(() => {
    if (detected && fgRef.current && ringIds.size) {
      setTimeout(() => {
        fgRef.current.zoomToFit(1200, 80, (n: any) => ringIds.has(n.id));
      }, 250);
    }
  }, [detected, ringIds]);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
    <ForceGraph2D
      ref={fgRef}
      width={size.w}
      height={size.h}
      graphData={data}
      backgroundColor="#0b0f14"
      cooldownTicks={120}
      nodeRelSize={4}
      linkColor={(l: any) =>
        l.kind === 'shared' ? 'rgba(255,59,87,0.55)' : detected && ringIds.has(idOf(l.source)) && ringIds.has(idOf(l.target)) ? 'rgba(255,140,60,0.7)' : 'rgba(120,140,160,0.12)'
      }
      linkWidth={(l: any) => (l.kind === 'shared' ? 2 : 0.6)}
      linkLineDash={(l: any) => (l.kind === 'shared' ? [4, 3] : null)}
      linkDirectionalParticles={(l: any) => (detected && ringIds.has(idOf(l.source)) && ringIds.has(idOf(l.target)) && l.kind === 'money' ? 3 : 0)}
      linkDirectionalParticleWidth={2.2}
      linkDirectionalParticleColor={() => MULE}
      nodeCanvasObject={(node: any, ctx, scale) => {
        const isMule = node.id === muleId;
        const inRing = ringIds.has(node.id);
        const r = isMule ? 9 : inRing ? 6 : 2.4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = isMule ? MULE : inRing ? RING : STEEL;
        ctx.fill();
        if (inRing) {
          ctx.strokeStyle = isMule ? '#fff2b0' : '#ff8ba0';
          ctx.lineWidth = 1.5 / scale;
          ctx.stroke();
          // label ring members once we've caught them
          if (scale > 1.1) {
            ctx.font = `${isMule ? 6 : 4.5}px Inter, sans-serif`;
            ctx.fillStyle = '#e8eef5';
            ctx.textAlign = 'center';
            ctx.fillText(isMule ? `🎯 ${node.name}` : node.name, node.x, node.y - r - 2);
          }
        }
      }}
      nodePointerAreaPaint={(node: any, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.id === muleId ? 9 : 5, 0, 2 * Math.PI);
        ctx.fill();
      }}
    />
    </div>
  );
}

const idOf = (x: any) => (typeof x === 'object' ? x.id : x);
