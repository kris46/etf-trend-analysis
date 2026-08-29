import type { TrendSignal } from "../../types/market";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function trendDirection(
  close: number,
  ema20: number | null,
  ema50: number | null,
  ema200: number | null
): TrendSignal {
  if (ema20 === null) return "Neutral";

  let bullVotes = 0;
  let bearVotes = 0;

  if (close > ema20) bullVotes++;
  else bearVotes++;

  if (ema50 !== null) {
    if (ema20 >= ema50) bullVotes++;
    else bearVotes++;
  }

  if (ema50 !== null && ema200 !== null) {
    if (ema50 >= ema200) bullVotes++;
    else bearVotes++;
  }

  if (bullVotes >= 2 && bullVotes > bearVotes) return "Bullish";
  if (bearVotes >= 2 && bearVotes > bullVotes) return "Bearish";
  return "Neutral";
}

/** 0-100, anchored on % distance of price from EMA200 (falls back to EMA50 if EMA200 isn't available yet). */
export function trendStrength(close: number, ema200: number | null, ema50: number | null): number {
  const anchor = ema200 ?? ema50;
  if (anchor === null || anchor === 0) return 50;
  const distancePct = ((close - anchor) / anchor) * 100;
  return Math.round(clamp(50 + distancePct * 4, 0, 100));
}
