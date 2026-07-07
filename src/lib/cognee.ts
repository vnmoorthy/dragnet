/**
 * Cognee (BONUS) = the agent's memory of confirmed fraud typologies.
 * After an investigator confirms a ring, we remember its "signature". On the
 * next detection we recall similar past cases so the agent says
 * "this matches a ring you confirmed before" — memory across sessions.
 *
 * Cognee is a Python/OSS library, so we run it as a tiny FastAPI sidecar
 * (see cognee_service.py) and call it over HTTP. If the sidecar is down we
 * fall back to a local JSON memory so the demo still shows recall.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEM_FILE = join(__dirname, '..', 'data', 'cognee-memory.json');
const SIDECAR = process.env.COGNEE_URL || '';
export const hasCognee = () => Boolean(SIDECAR);

type Memory = { signature: string; typology: string; ringId: string; note: string }[];

function local(): Memory {
  if (!existsSync(MEM_FILE)) return [];
  try { return JSON.parse(readFileSync(MEM_FILE, 'utf8')); } catch { return []; }
}
function saveLocal(m: Memory) { writeFileSync(MEM_FILE, JSON.stringify(m, null, 2)); }

// signature = coarse fingerprint we match on (typology + rough size band)
function sig(typology: string, size: number) {
  const band = size <= 5 ? 'small' : size <= 12 ? 'medium' : 'large';
  return `${typology}:${band}`;
}

export async function remember(entry: { typology: string; size: number; ringId: string; note: string }) {
  const signature = sig(entry.typology, entry.size);
  if (hasCognee()) {
    try {
      await fetch(`${SIDECAR}/remember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, ...entry }),
      });
      return;
    } catch { /* fall through to local */ }
  }
  const m = local();
  m.push({ signature, typology: entry.typology, ringId: entry.ringId, note: entry.note });
  saveLocal(m);
}

export async function recall(typology: string, size: number): Promise<string | null> {
  const signature = sig(typology, size);
  if (hasCognee()) {
    try {
      const r = await fetch(`${SIDECAR}/recall?signature=${encodeURIComponent(signature)}`);
      if (r.ok) { const d = await r.json(); return d.match || null; }
    } catch { /* fall through */ }
  }
  const hit = local().find((m) => m.signature === signature);
  return hit ? `Matches ${hit.ringId}: ${hit.note}` : null;
}
