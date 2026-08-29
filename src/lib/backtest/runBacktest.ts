import type {
  BacktestConfig,
  BacktestResult,
  BacktestSnapshot,
  EquityPoint,
  Strategy,
  SymbolIndicators,
  SymbolSeries,
  Trade,
} from "../../types/market";
import { computeSymbolTimeSeries, snapshotAt, type SymbolTimeSeries } from "../indicatorTimeSeries";
import { computeRankings } from "../ranking/compositeRanking";
import { matchScore } from "./fields";

interface OpenPosition {
  entryDate: string;
  entryIndex: number; // bar index, in that symbol's own series, of the executed entry
  entryPrice: number; // post cost+slippage
}

/**
 * Design notes (read this before trusting the numbers):
 *
 * - Signals are evaluated using only data known by the close of day t; any
 *   resulting trade executes at day t+1's Open, never day t's own close --
 *   this is the standard way to avoid "use the same bar's data that
 *   generated the signal as the fill price" lookahead bias.
 * - Exits are purely holding-period based (no early exit on a reversed
 *   signal) -- this keeps "Holding Period Analysis" a clean, isolated
 *   variable. A signal-based exit is a reasonable Phase 4 addition.
 * - Position sizing is a FIXED allocation per trade (`positionSizePct` of
 *   the *starting* capital, not the current equity) rather than fully
 *   compounding portfolio reinvestment. This is a deliberate simplification:
 *   real concurrent-position compounding requires modeling capital
 *   contention across simultaneously open trades, which adds real
 *   complexity for a Phase 3 first cut. Trade-level stats (win rate, profit
 *   factor, average return, holding period) are unaffected by this choice
 *   either way since they're computed from each trade's own return %.
 * - The equity curve is mark-to-market: every day, equity = starting
 *   capital + realized P&L from closed trades + unrealized P&L on
 *   currently open positions (at that day's close). Drawdown is computed
 *   from this real day-by-day curve, not just the jumps at trade exits.
 */
export function runBacktest(strategy: Strategy, config: BacktestConfig, seriesBySymbol: Record<string, SymbolSeries>): BacktestResult {
  const benchmarkSeries = seriesBySymbol[config.benchmark] ?? null;
  const universe = config.universe.filter((s) => seriesBySymbol[s]);

  // expensive per-symbol computation happens ONCE, not once per backtest day
  const tsBySymbol: Record<string, SymbolTimeSeries> = {};
  const dateIndexBySymbol: Record<string, Map<string, number>> = {};
  for (const symbol of universe) {
    const ts = computeSymbolTimeSeries(seriesBySymbol[symbol], benchmarkSeries);
    tsBySymbol[symbol] = ts;
    dateIndexBySymbol[symbol] = new Map(ts.dates.map((d, i) => [d, i]));
  }

  const calendarSource = benchmarkSeries ?? seriesBySymbol[universe[0]];
  const calendar = calendarSource.bars.map((b) => b.Date).filter((d) => d >= config.startDate && d <= config.endDate);

  const open: Record<string, OpenPosition> = {};
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  const fixedAllocation = config.startingCapital * (config.positionSizePct / 100);
  const costFrac = (config.costBps + config.slippageBps) / 10000;

  let realizedPnl = 0;

  for (const date of calendar) {
    // 1. today's cross-sectional snapshot + ranking, reusing the exact ranking engine the dashboard uses
    const todaysIndicators: SymbolIndicators[] = [];
    const indexOfSymbol: Record<string, number> = {};
    for (const symbol of universe) {
      const idx = dateIndexBySymbol[symbol].get(date);
      if (idx === undefined) continue;
      indexOfSymbol[symbol] = todaysIndicators.length;
      todaysIndicators.push(snapshotAt(tsBySymbol[symbol], idx));
    }
    const { rankings } = computeRankings(todaysIndicators);
    const rankingBySymbol = new Map(rankings.map((r) => [r.symbol, r]));

    // 2. exits (holding period reached)
    for (const symbol of Object.keys(open)) {
      const pos = open[symbol];
      const barIdx = dateIndexBySymbol[symbol].get(date);
      if (barIdx === undefined) continue;
      const heldDays = barIdx - pos.entryIndex;
      if (heldDays < strategy.holdingPeriodDays) continue;

      const bars = tsBySymbol[symbol].bars;
      const exitBarIdx = Math.min(barIdx + 1, bars.length - 1);
      const exitPrice = bars[exitBarIdx].Open * (1 - costFrac);
      const returnPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
      const pnl = fixedAllocation * (returnPct / 100);

      trades.push({
        symbol,
        entryDate: pos.entryDate,
        entryPrice: pos.entryPrice,
        exitDate: bars[exitBarIdx].Date,
        exitPrice,
        holdingDays: exitBarIdx - pos.entryIndex,
        returnPct,
        pnl,
      });
      realizedPnl += pnl;
      delete open[symbol];
    }

    // 3. entries (only symbols without an open position)
    for (const symbol of universe) {
      if (open[symbol]) continue;
      const indIdx = indexOfSymbol[symbol];
      if (indIdx === undefined) continue;

      const ranking = rankingBySymbol.get(symbol);
      const snap: BacktestSnapshot = {
        ...todaysIndicators[indIdx],
        compositeScore: ranking?.compositeScore ?? 50,
        compositeSignal: ranking?.compositeSignal ?? "WATCH",
      };

      if (matchScore(strategy.conditions, snap) < strategy.entryThreshold) continue;

      const barIdx = dateIndexBySymbol[symbol].get(date)!;
      const bars = tsBySymbol[symbol].bars;
      const entryBarIdx = barIdx + 1;
      if (entryBarIdx > bars.length - 1) continue; // no next bar to execute on (end of this symbol's data)

      const entryPrice = bars[entryBarIdx].Open * (1 + costFrac);
      open[symbol] = { entryDate: bars[entryBarIdx].Date, entryIndex: entryBarIdx, entryPrice };
    }

    // 4. mark-to-market equity for today
    let unrealizedPnl = 0;
    for (const symbol of Object.keys(open)) {
      const pos = open[symbol];
      const barIdx = dateIndexBySymbol[symbol].get(date);
      if (barIdx === undefined) continue;
      const currentClose = tsBySymbol[symbol].bars[barIdx].Close;
      const unrealizedReturnPct = ((currentClose - pos.entryPrice) / pos.entryPrice) * 100;
      unrealizedPnl += fixedAllocation * (unrealizedReturnPct / 100);
    }
    equityCurve.push({ date, equity: config.startingCapital + realizedPnl + unrealizedPnl });
  }

  // close any positions still open at the end of the window, at the last available close
  for (const symbol of Object.keys(open)) {
    const pos = open[symbol];
    const bars = tsBySymbol[symbol].bars;
    const lastIdx = bars.length - 1;
    const exitPrice = bars[lastIdx].Close * (1 - costFrac);
    const returnPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const pnl = fixedAllocation * (returnPct / 100);
    trades.push({
      symbol,
      entryDate: pos.entryDate,
      entryPrice: pos.entryPrice,
      exitDate: bars[lastIdx].Date,
      exitPrice,
      holdingDays: lastIdx - pos.entryIndex,
      returnPct,
      pnl,
    });
    realizedPnl += pnl;
  }

  trades.sort((a, b) => (a.entryDate < b.entryDate ? -1 : 1));

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.returnPct > 0);
  const losses = trades.filter((t) => t.returnPct <= 0);
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0;
  const averageReturnPct = totalTrades > 0 ? trades.reduce((s, t) => s + t.returnPct, 0) / totalTrades : 0;
  const avgHoldingDays = totalTrades > 0 ? trades.reduce((s, t) => s + t.holdingDays, 0) / totalTrades : 0;

  let peak = config.startingCapital;
  let maxDrawdownPct = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    const dd = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    maxDrawdownPct = Math.max(maxDrawdownPct, dd);
  }

  const finalEquity = equityCurve.at(-1)?.equity ?? config.startingCapital;
  const totalReturnPct = ((finalEquity - config.startingCapital) / config.startingCapital) * 100;

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    trades,
    equityCurve,
    stats: { totalTrades, winRate, profitFactor, averageReturnPct, avgHoldingDays, maxDrawdownPct, finalEquity, totalReturnPct },
  };
}
