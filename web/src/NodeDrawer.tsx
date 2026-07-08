import type { NodeDetail } from './api';

// Click-to-inspect drawer — real per-account intelligence.
export default function NodeDrawer({ detail, onClose }: { detail: NodeDetail | null; onClose: () => void }) {
  if (!detail) return null;
  return (
    <div className="drawer-bg" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="dr-head">
          <div><div className="dr-name">{detail.name}</div><div className="dr-id">{detail.id}</div></div>
          <button className="dr-close" onClick={onClose}>✕</button>
        </div>

        {detail.isMule ? (
          <div className="dr-flag mule">🎯 MULE · funnel target</div>
        ) : detail.inRing ? (
          <div className="dr-flag ring">⚠ Ring member</div>
        ) : (
          <div className="dr-flag ok">✓ No ring association</div>
        )}

        <div className="dr-grid">
          <div className="dr-cell"><span className="dr-k">Balance</span><span className="dr-v">${detail.balance.toLocaleString()}</span></div>
          <div className="dr-cell"><span className="dr-k">Account age</span><span className="dr-v">{detail.openedDaysAgo}d</span></div>
          <div className="dr-cell"><span className="dr-k">Status</span><span className="dr-v">{detail.flagged ? 'frozen' : 'active'}</span></div>
          <div className="dr-cell"><span className="dr-k">Fingerprints</span><span className="dr-v">{detail.devices.length + detail.ips.length}</span></div>
        </div>

        <div className="dr-section">Devices · {detail.devices.length}</div>
        <div className="dr-chips">{detail.devices.map((d) => <span key={d} className="dr-chip">{d}</span>)}</div>
        <div className="dr-section">IP addresses · {detail.ips.length}</div>
        <div className="dr-chips">{detail.ips.map((d) => <span key={d} className="dr-chip">{d}</span>)}</div>

        {detail.inRing && <div className="dr-note">Shared fingerprints with other flagged accounts — a coordination signal graph traversal surfaced.</div>}
      </div>
    </div>
  );
}
