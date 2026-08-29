import type { OhlcvBar } from "../../types/market";
import { sma } from "./movingAverage";

export function deliveryAvg20(bars: OhlcvBar[], period = 20): (number | null)[] {
  const values = bars.map((b) => b.DeliveryPercent ?? NaN);
  const avg = sma(
    values.map((v) => (Number.isNaN(v) ? 0 : v)),
    period
  );
  // if every value in the window was missing, report null instead of 0
  return avg.map((v, i) => {
    if (v === null) return null;
    const windowHasData = values.slice(Math.max(0, i - period + 1), i + 1).some((x) => !Number.isNaN(x));
    return windowHasData ? v : null;
  });
}

/** As-of `endIndex` (defaults to "today"); see the note in volume.ts -- same pattern throughout. */
export function deliveryTrend(
  bars: OhlcvBar[],
  lookback = 10,
  endIndex = bars.length - 1,
  avgSeries = deliveryAvg20(bars)
): "Rising" | "Falling" | "Flat" {
  const j = endIndex - lookback;
  if (j < 0) return "Flat";
  const curr = avgSeries[endIndex];
  const prior = avgSeries[j];
  if (curr === null || prior === null || prior === 0) return "Flat";
  const change = ((curr - prior) / prior) * 100;
  if (change >= 5) return "Rising";
  if (change <= -5) return "Falling";
  return "Flat";
}

/**
 * Heuristic v1: weights each day's delivery % toward "accumulation" if it
 * was an up day, or "distribution" if it was a down day, over a trailing
 * window. High delivery % on up days reads as genuine (non-intraday)
 * buying interest; the inverse on down days reads as genuine selling.
 * This is intentionally simple and transparent — Phase 3's backtester
 * validates this heuristic against real trade outcomes rather than
 * assuming it's correct.
 */
export function accumulationDistributionScores(
  bars: OhlcvBar[],
  window = 10,
  endIndex = bars.length - 1
): { accumulationScore: number; distributionScore: number } {
  if (endIndex < window) return { accumulationScore: 50, distributionScore: 50 };

  let accum = 0;
  let distrib = 0;
  for (let i = endIndex - window + 1; i <= endIndex; i++) {
    if (i < 1) continue;
    const deliveryPct = bars[i].DeliveryPercent;
    if (deliveryPct === null) continue;
    const isUpDay = bars[i].Close >= bars[i - 1].Close;
    if (isUpDay) accum += deliveryPct;
    else distrib += deliveryPct;
  }

  const total = accum + distrib;
  if (total === 0) return { accumulationScore: 50, distributionScore: 50 };
  const accumulationScore = Math.round((accum / total) * 100);
  return { accumulationScore, distributionScore: 100 - accumulationScore };
}
