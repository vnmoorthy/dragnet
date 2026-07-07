/**
 * RocketRide Cloud = your DEPLOYED AI pipeline. This is the mandatory
 * "runs in production, not local" piece. The app calls the hosted endpoint;
 * the pipeline (see /pipeline/dragnet.pipe.json) runs the multi-agent
 * Score -> Investigate -> Narrate flow over a detected ring subgraph.
 *
 * ROCKETRIDE_ENDPOINT should be the invoke URL you get after one-click deploy
 * at cloud.rocketride.ai. Falls back to a local narration so the demo survives.
 */
const ENDPOINT = process.env.ROCKETRIDE_ENDPOINT || '';
const KEY = process.env.ROCKETRIDE_API_KEY || '';
export const hasRocketRide = () => Boolean(ENDPOINT);

export type RingInput = {
  ringId: string;
  accounts: { id: string; name: string; openedDaysAgo: number; betweenness: number }[];
  mule: string;
  totalAmount: number;
  sharedDevices: number;
  txCount: number;
};

export type RingVerdict = {
  riskScore: number;      // 0-100
  typology: string;       // e.g. "structuring / smurfing"
  narrative: string;      // human-readable investigator briefing
  recommendedAction: string;
};

export async function investigateRing(input: RingInput): Promise<RingVerdict> {
  if (hasRocketRide()) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
        },
        body: JSON.stringify({ input }),
      });
      if (res.ok) {
        const data = await res.json();
        // RocketRide returns the terminal node's output; tolerate a couple shapes
        return (data.output ?? data.result ?? data) as RingVerdict;
      }
      console.warn('RocketRide non-200, using local narration:', res.status);
    } catch (e) {
      console.warn('RocketRide unreachable, using local narration:', (e as Error).message);
    }
  }
  return localVerdict(input);
}

// Deterministic local stand-in that mirrors the deployed pipeline's output.
function localVerdict(input: RingInput): RingVerdict {
  const freshAccounts = input.accounts.filter((a) => a.openedDaysAgo <= 30).length;
  const riskScore = Math.min(
    99,
    40 + input.sharedDevices * 8 + freshAccounts * 4 + Math.min(20, input.txCount),
  );
  const muleName = input.accounts.find((a) => a.id === input.mule)?.name ?? input.mule;
  const narrative =
    `Detected a ${input.accounts.length}-account cluster funneling ` +
    `$${input.totalAmount.toLocaleString()} into a single mule (${muleName}). ` +
    `${input.accounts.length - 1} feeder accounts share ${input.sharedDevices} device/IP ` +
    `fingerprint(s) and were opened within the last 30 days — a classic structuring ring ` +
    `engineered to stay under individual reporting thresholds.`;
  return {
    riskScore,
    typology: 'structuring / smurfing',
    narrative,
    recommendedAction: 'Freeze all feeder accounts and the mule; file SAR; escalate to Tier-2.',
  };
}
