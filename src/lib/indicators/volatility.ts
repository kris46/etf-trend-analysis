import type { OhlcvBar } from "../../types/market";
import { ema } from "./movingAverage";

function trueRange(curr: OhlcvBar, prevClose: number): number {
  return Math.max(
    curr.High - curr.Low,
    Math.abs(curr.High - prevClose),
    Math.abs(curr.Low - prevClose)
  );
}

/** Wilder's ATR (implemented as an EMA of true range, period default 14). */
export function atr(bars: OhlcvBar[], period = 14): (number | null)[] {
  if (bars.length < 2) return bars.map(() => null);
  const trueRanges: number[] = [bars[0].High - bars[0].Low];
  for (let i = 1; i < bars.length; i++) {
    trueRanges.push(trueRange(bars[i], bars[i - 1].Close));
  }
  return ema(trueRanges, period);
}

export function atrPercent(bars: OhlcvBar[], period = 14): (number | null)[] {
  const atrSeries = atr(bars, period);
  return atrSeries.map((value, i) => (value === null ? null : (value / bars[i].Close) * 100));
}

/**
 * Where today's ATR% sits relative to its own trailing history (0-100
 * percentile). High = unusually volatile right now for this symbol.
 */
export function volatilityRank(atrPctSeries: (number | null)[], lookback = 252): number | null {
  const clean = atrPctSeries.filter((v): v is number => v !== null);
  if (clean.length < 20) return null;
  const window = clean.slice(-lookback);
  const latest = window[window.length - 1];
  const below = window.filter((v) => v <= latest).length;
  return Math.round((below / window.length) * 100);
}

/** Same metric, computed causally at every index (for the backtest engine -- never looks past index i). */
export function volatilityRankSeries(atrPctSeries: (number | null)[], lookback = 252): (number | null)[] {
  return atrPctSeries.map((value, i) => {
    if (value === null) return null;
    const windowStart = Math.max(0, i - lookback + 1);
    const window = atrPctSeries.slice(windowStart, i + 1).filter((v): v is number => v !== null);
    if (window.length < 20) return null;
    const below = window.filter((v) => v <= value).length;
    return Math.round((below / window.length) * 100);
  });
}
