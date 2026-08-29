import { useMemo } from "react";
import { useMarketStore } from "../store/useMarketStore";
import { RankingTable, type RankRow } from "../components/common/RankingTable";
import { StatCard } from "../components/common/StatCard";

export function MarketOverviewPage() {
  const status = useMarketStore((s) => s.status);
  const error = useMarketStore((s) => s.error);
  const rankings = useMarketStore((s) => s.rankings);
  const indicatorsBySymbol = useMarketStore((s) => s.indicatorsBySymbol);
  const benchmark = useMarketStore((s) => s.benchmark);

  const rows: RankRow[] = useMemo(
    () =>
      rankings.map((ranking, i) => ({
        rank: i + 1,
        ranking,
        indicators: indicatorsBySymbol[ranking.symbol],
      })),
    [rankings, indicatorsBySymbol]
  );

  const summary = useMemo(() => {
    const all = Object.values(indicatorsBySymbol);
    if (all.length === 0) return null;
    const avgRsRoc = average(all.map((i) => i.rsRoc).filter((v): v is number => v !== null));
    const breadthAboveEma200 = (all.filter((i) => i.ema200 !== null && i.close >= i.ema200).length / all.length) * 100;
    const accumulationCount = all.filter((i) => i.volumeTrendSignal === "Accumulation").length;
    const buyCount = rankings.filter((r) => r.compositeSignal === "BUY").length;
    return { avgRsRoc, breadthAboveEma200, accumulationCount, buyCount, total: all.length };
  }, [indicatorsBySymbol, rankings]);

  if (status === "loading" || status === "idle") {
    return <div className="text-sm text-ink-muted">Loading market data…</div>;
  }

  if (status === "error") {
    return (
      <div className="rounded-sm border border-bear/30 bg-bear-bg px-4 py-3 text-sm text-bear">
        Couldn't load market data{error ? `: ${error}` : "."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-lg font-semibold">Market Overview</h1>
        <p className="text-sm text-ink-muted">
          {summary?.total ?? 0} ETFs ranked against <span className="text-ink">{benchmark}</span>
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="BUY signals"
            value={`${summary.buyCount}`}
            suffix={` / ${summary.total}`}
            tone={summary.buyCount > 0 ? "bull" : "neutral"}
          />
          <StatCard
            label="Avg RS RoC (20d)"
            value={`${summary.avgRsRoc >= 0 ? "+" : ""}${summary.avgRsRoc.toFixed(1)}`}
            suffix="%"
            tone={summary.avgRsRoc >= 0 ? "bull" : "bear"}
          />
          <StatCard
            label="Breadth above EMA200"
            value={summary.breadthAboveEma200.toFixed(0)}
            suffix="%"
            tone={summary.breadthAboveEma200 >= 50 ? "bull" : "watch"}
          />
          <StatCard
            label="Accumulation count"
            value={`${summary.accumulationCount}`}
            suffix={` / ${summary.total}`}
            tone="neutral"
          />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-[13px] font-medium text-ink-muted">Ranked ETFs</h2>
        <RankingTable rows={rows} />
      </div>
    </div>
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
