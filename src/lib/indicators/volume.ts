import type { OhlcvBar, VolumeSignal } from "../../types/market";
import { sma } from "./movingAverage";

export function avgVolume20(bars: OhlcvBar[], period = 20): (number | null)[] {
  return sma(bars.map((b) => b.Volume), period);
}

/**
 * Volume at `endIndex` is at least `multiple`x its 20-day average.
 * `endIndex` defaults to "today" (the live snapshot use case) but every
 * function here also accepts an explicit historical index so the backtest
 * engine can ask "what would this have read as of day i" using the exact
 * same logic the live dashboard uses -- no separate backtest-only code path.
 */
export function isVolumeSpike(bars: OhlcvBar[], multiple = 1.5, endIndex = bars.length - 1, avg = avgVolume20(bars)): boolean {
  const a = avg[endIndex];
  if (a === null || a === 0) return false;
  return bars[endIndex].Volume / a >= multiple;
}

/** Short-term (5d) average volume meaningfully above the 20-day average -> participation building. */
export function isVolumeExpansion(bars: OhlcvBar[], endIndex = bars.length - 1, avg = avgVolume20(bars)): boolean {
  if (endIndex < 24) return false;
  const recentVols = bars.slice(endIndex - 4, endIndex + 1).map((b) => b.Volume);
  const recentAvg = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  const baseline = avg[endIndex];
  if (baseline === null || baseline === 0) return false;
  return recentAvg / baseline >= 1.2;
}

/**
 * Classifies recent volume behaviour against price direction, looking back
 * `window` sessions from `endIndex`.
 * Accumulation: above-average volume on up days outweighs down days.
 * Distribution: the reverse. Neutral: no clear lean.
 */
export function volumeTrendSignal(bars: OhlcvBar[], window = 10, endIndex = bars.length - 1, avg = avgVolume20(bars)): VolumeSignal {
  if (endIndex < window) return "Neutral";
  let upVol = 0;
  let downVol = 0;
  for (let i = endIndex - window + 1; i <= endIndex; i++) {
    const a = avg[i];
    if (a === null || a === 0 || i < 1) continue;
    const relVol = bars[i].Volume / a;
    const isUpDay = bars[i].Close >= bars[i - 1].Close;
    if (isUpDay) upVol += relVol;
    else downVol += relVol;
  }
  const total = upVol + downVol;
  if (total === 0) return "Neutral";
  const upShare = upVol / total;
  if (upShare >= 0.58) return "Accumulation";
  if (upShare <= 0.42) return "Distribution";
  return "Neutral";
}
