import type { RedeemResult } from './types';

// Holds the latest successful redemption for the success screen (avoids serialising it into the URL).
let last: RedeemResult | null = null;
export const setLastRedemption = (r: RedeemResult) => { last = r; };
export const getLastRedemption = () => last;

/** Accepts the raw QR value or a link like https://perkly.app/r/PK-XXXX or perkly://r/PK-XXXX */
export function extractCode(raw: string) {
  const s = raw.trim();
  const m = s.match(/(PK-[A-Z0-9]{6,32})/i);
  return (m ? m[1] : s).toUpperCase();
}
