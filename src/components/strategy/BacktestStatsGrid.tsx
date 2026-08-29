import type { BacktestStats } from "../../types/market";
import { StatCard } from "../common/StatCard";

export function BacktestStatsGrid({ stats }: { stats: BacktestStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total Trades" value={`${stats.totalTrades}`} />
      <StatCard label="Win Rate" value={stats.winRate.toFixed(1)} suffix="%" tone={stats.winRate >= 50 ? "bull" : "bear"} />
      <StatCard label="Profit Factor" value={stats.profitFactor === null ? "∞" : stats.profitFactor.toFixed(2)} tone={(stats.profitFactor ?? 0) >= 1.5 ? "bull" : "watch"} />
      <StatCard label="Avg Return / Trade" value={`${stats.averageReturnPct >= 0 ? "+" : ""}${stats.averageReturnPct.toFixed(2)}`} suffix="%" tone={stats.averageReturnPct >= 0 ? "bull" : "bear"} />
      <StatCard label="Avg Holding Days" value={stats.avgHoldingDays.toFixed(1)} />
      <StatCard label="Max Drawdown" value={stats.maxDrawdownPct.toFixed(2)} suffix="%" tone={stats.maxDrawdownPct > 15 ? "bear" : "watch"} />
      <StatCard label="Total Return" value={`${stats.totalReturnPct >= 0 ? "+" : ""}${stats.totalReturnPct.toFixed(2)}`} suffix="%" tone={stats.totalReturnPct >= 0 ? "bull" : "bear"} />
      <StatCard label="Final Equity" value={stats.finalEquity.toFixed(0)} />
    </div>
  );
}
