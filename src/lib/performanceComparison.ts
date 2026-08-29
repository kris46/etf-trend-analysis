import type { SymbolSeries } from "../types/market";

export interface PerformancePoint {
  date: string;
  pctReturn: number; // % change vs the first bar in the window (0 at the start, by construction)
}

export interface PerformanceSeries {
  symbol: string;
  points: PerformancePoint[];
}

/**
 * For each symbol, finds its own first available bar on/after `cutoffDate`
 * and rebases every bar from there to a % return relative to that bar's
 * close. All lines start at 0% by construction and diverge from there --
 * this is a pure price comparison (no benchmark involved), unlike the RRG
 * engine's RS-Ratio.
 */
export function computePerformanceComparison(
  seriesBySymbol: Record<string, SymbolSeries>,
  symbols: string[],
  cutoffDate: string
): PerformanceSeries[] {
  return symbols
    .map((symbol) => {
      const series = seriesBySymbol[symbol];
      if (!series) return null;

      const bars = series.bars.filter((b) => b.Date >= cutoffDate);
      if (bars.length === 0) return null;

      const baseClose = bars[0].Close;
      if (!baseClose) return null;

      const points: PerformancePoint[] = bars.map((b) => ({
        date: b.Date,
        pctReturn: ((b.Close - baseClose) / baseClose) * 100,
      }));

      return { symbol, points };
    })
    .filter((s): s is PerformanceSeries => s !== null);
}

export const WINDOW_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "15D", days: 15 },
  { label: "21D", days: 21 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
] as const;

/** Calendar-day cutoff back from `latestDate` (simple subtraction -- fine for these short windows). */
export function cutoffDateFor(latestDate: string, windowDays: number): string {
  const d = new Date(latestDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - windowDays);
  return d.toISOString().slice(0, 10);
}
