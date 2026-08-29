import type { SymbolIndicators, SymbolSeries } from "../types/market";
import { computeSymbolTimeSeries, snapshotAt } from "./indicatorTimeSeries";

/**
 * Live-dashboard snapshot for one symbol as of its latest bar. This is now
 * a thin wrapper over the same time-series engine the backtest engine uses
 * (computeSymbolTimeSeries + snapshotAt) -- by construction, today's
 * dashboard numbers and "day N" of a backtest can never drift apart, because
 * they're the same function evaluated at different indices.
 */
export function computeSymbolIndicators(series: SymbolSeries, benchmark: SymbolSeries | null): SymbolIndicators {
  if (series.bars.length < 2) {
    throw new Error(`${series.symbol}: not enough bars to compute indicators`);
  }
  const ts = computeSymbolTimeSeries(series, benchmark);
  return snapshotAt(ts, ts.bars.length - 1);
}

/** Re-exported for chart/page components that need the full series, not just the latest snapshot. */
export { ema } from "./indicators/movingAverage";
export { computeRelativeStrength } from "./indicators/relativeStrength";
export { computeRrgSeries, computeRrgLatestMetrics } from "./indicators/rrg";
export { computeRenko, computeRenkoLatestMetrics } from "./indicators/renko";
export { computeSymbolTimeSeries, snapshotAt } from "./indicatorTimeSeries";
