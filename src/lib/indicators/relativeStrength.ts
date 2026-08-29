import type { OhlcvBar, RsSignal, TrendSignal } from "../../types/market";
import { ema } from "./movingAverage";

export interface RelativeStrengthResult {
  dates: string[];
  series: number[]; // RS line rebased to 100 at the first aligned date, one per date

  // full per-day series, aligned to `dates` -- what the backtest engine walks through
  rsRocSeries: (number | null)[];
  rsTrendSeries: TrendSignal[];
  rsSignalSeries: RsSignal[];

  // convenience accessors = the last entry of each series above (what the live dashboard uses)
  rsRoc: number | null;
  rsTrend: TrendSignal;
  rsSignal: RsSignal;
}

/** Keep only the dates both series share, in order. */
function alignByDate(symbol: OhlcvBar[], benchmark: OhlcvBar[]) {
  const benchByDate = new Map(benchmark.map((bar) => [bar.Date, bar]));
  const alignedSymbol: OhlcvBar[] = [];
  const alignedBenchmark: OhlcvBar[] = [];
  for (const bar of symbol) {
    const match = benchByDate.get(bar.Date);
    if (match) {
      alignedSymbol.push(bar);
      alignedBenchmark.push(match);
    }
  }
  return { alignedSymbol, alignedBenchmark };
}

export function computeRelativeStrength(
  symbolBars: OhlcvBar[],
  benchmarkBars: OhlcvBar[],
  rocLookback = 20
): RelativeStrengthResult {
  const empty: RelativeStrengthResult = {
    dates: [],
    series: [],
    rsRocSeries: [],
    rsTrendSeries: [],
    rsSignalSeries: [],
    rsRoc: null,
    rsTrend: "Neutral",
    rsSignal: "WATCH",
  };

  const { alignedSymbol, alignedBenchmark } = alignByDate(symbolBars, benchmarkBars);
  if (alignedSymbol.length < 2) return empty;

  const raw = alignedSymbol.map((bar, i) => bar.Close / alignedBenchmark[i].Close);
  const base = raw[0];
  const series = raw.map((v) => (v / base) * 100);
  const dates = alignedSymbol.map((b) => b.Date);

  // RS rate-of-change, causal at every index: % change vs `rocLookback` sessions earlier.
  const rsRocSeries: (number | null)[] = series.map((v, i) => {
    const j = i - rocLookback;
    if (j < 0 || series[j] === 0) return null;
    return ((v - series[j]) / series[j]) * 100;
  });

  // RS trend, causal at every index: is the 20-session EMA of RS itself rising or falling vs 5 sessions ago.
  const rsEma = ema(series, 20);
  const rsTrendSeries: TrendSignal[] = rsEma.map((val, i) => {
    const priorIdx = i - 5;
    const prior = priorIdx >= 0 ? rsEma[priorIdx] : null;
    if (val === null || prior === null || prior === 0) return "Neutral";
    const pctMove = ((val - prior) / prior) * 100;
    if (pctMove > 0.5) return "Bullish";
    if (pctMove < -0.5) return "Bearish";
    return "Neutral";
  });

  const rsSignalSeries: RsSignal[] = rsTrendSeries.map((trend, i) => {
    const roc = rsRocSeries[i] ?? 0;
    if (trend === "Bullish" && roc > 0) return "BUY";
    if (trend === "Bearish" && roc < 0) return "SELL";
    return "WATCH";
  });

  return {
    dates,
    series,
    rsRocSeries,
    rsTrendSeries,
    rsSignalSeries,
    rsRoc: rsRocSeries.at(-1) ?? null,
    rsTrend: rsTrendSeries.at(-1) ?? "Neutral",
    rsSignal: rsSignalSeries.at(-1) ?? "WATCH",
  };
}
