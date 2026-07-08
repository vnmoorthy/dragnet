import { useMemo, useState } from 'react';

// Persistent, referenceable case record after a freeze — makes the action feel real.
export default function CaseFooter({ frozen, typology, mule }: { frozen: number; typology: string; mule: string }) {
  const caseId = useMemo(() => `CASE-${Date.now().toString(36).toUpperCase().slice(-6)}`, []);
  const ts = useMemo(() => new Date().toISOString().slice(0, 19).replace('T', ' ') + 'Z', []);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const rec = `${caseId} · ${typology} · mule ${mule} · ${frozen} accounts frozen · ${ts}`;
    navigator.clipboard?.writeText(rec).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };

  return (
    <div className="case-footer">
      <div className="cf-top">
        <span className="cf-frozen">✅ {frozen} accounts frozen</span>
        <button className="cf-copy" onClick={copy}>{copied ? '✓ copied' : '⧉ copy case'}</button>
      </div>
      <div className="cf-grid">
        <div><span className="cf-k">Case ID</span><span className="cf-v mono">{caseId}</span></div>
        <div><span className="cf-k">Typology</span><span className="cf-v">{typology}</span></div>
        <div><span className="cf-k">Opened</span><span className="cf-v mono">{ts}</span></div>
        <div><span className="cf-k">Saved to</span><span className="cf-v">Butterbase</span></div>
      </div>
    </div>
  );
}
