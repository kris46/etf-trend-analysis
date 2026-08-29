import { useParams, Link, useNavigate } from "react-router-dom";
import { useMarketStore } from "../store/useMarketStore";
import { PriceVolumeChart } from "../components/charts/PriceVolumeChart";
import { DeliveryChart } from "../components/charts/DeliveryChart";
import { RelativePerformanceChart } from "../components/charts/RelativePerformanceChart";
import { RenkoChart } from "../components/charts/RenkoChart";
import { RrgChart } from "../components/charts/RrgChart";
import { SignalBadge } from "../components/common/SignalBadge";
import { NumCell } from "../components/common/NumCell";
import { ExplainabilityCard } from "../components/common/ExplainabilityCard";
import { buildExplainability } from "../lib/explainability/explain";

export function EtfDetailPage() {
  const { symbol = "" } = useParams();
  const navigate = useNavigate();
  const series = useMarketStore((s) => s.getSeries(symbol));
  const indicators = useMarketStore((s) => s.getIndicators(symbol));
  const ranking = useMarketStore((s) => s.getRanking(symbol));
  const benchmark = useMarketStore((s) => s.benchmark);
  const benchmarkSeries = useMarketStore((s) => s.getSeries(benchmark));
  const rrgSeries = useMarketStore((s) => s.getRrgSeries(symbol));
  const renko = useMarketStore((s) => s.getRenko(symbol));

  if (!series || !indicators || !ranking) {
    return (
      <div className="text-sm text-ink-muted">
        No data for <span className="text-ink">{symbol}</span>.{" "}
        <Link to="/" className="text-signal hover:underline">
          Back to overview
        </Link>
      </div>
    );
  }

  const explainability = buildExplainability(indicators, ranking);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link to="/" className="text-xs text-ink-muted hover:text-ink">
            ← Market Overview
          </Link>
          <h1 className="font-display text-xl font-semibold">{symbol}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="num text-2xl">{indicators.close.toFixed(2)}</span>
          <NumCell value={indicators.changePct} suffix="%" colorBySign decimals={2} />
          <SignalBadge label={ranking.compositeSignal} />
          <span className="num text-sm text-ink-muted">score {ranking.compositeScore}/100</span>
        </div>
      </div>

      <section>
        <SectionLabel>Why this signal</SectionLabel>
        <ExplainabilityCard result={explainability} />
      </section>

      <section>
        <SectionLabel>Price &amp; Volume</SectionLabel>
        <div className="rounded-sm border border-line bg-surface p-2">
          <PriceVolumeChart bars={series.bars} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionLabel>Relative Performance vs {benchmark}</SectionLabel>
          <div className="rounded-sm border border-line bg-surface p-2">
            {benchmarkSeries ? (
              <RelativePerformanceChart
                symbolBars={series.bars}
                benchmarkBars={benchmarkSeries.bars}
                symbolLabel={symbol}
                benchmarkLabel={benchmark}
              />
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-ink-muted">
                Benchmark data unavailable
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>RRG Position</SectionLabel>
            <button onClick={() => navigate("/rrg")} className="text-xs text-signal hover:underline">
              Open full RRG Analysis →
            </button>
          </div>
          <div className="h-[260px] rounded-sm border border-line bg-surface p-2">
            {rrgSeries && rrgSeries.points.length > 0 ? (
              <RrgChart seriesList={[rrgSeries]} asOfDate={rrgSeries.points.at(-1)!.date} trailLength={15} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                RRG unavailable (no benchmark overlap or insufficient history)
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionLabel>Delivery %</SectionLabel>
          <div className="rounded-sm border border-line bg-surface p-2">
            <DeliveryChart bars={series.bars} />
          </div>
        </section>

        <section>
          <SectionLabel>
            Renko ({renko ? `${renko.brickSize.toFixed(2)} brick, ${renko.method === "atr" ? "ATR-based" : "fixed"}` : "—"})
          </SectionLabel>
          <div className="rounded-sm border border-line bg-surface p-2">
            {renko ? <RenkoChart result={renko} /> : <div className="flex h-[280px] items-center justify-center text-sm text-ink-muted">Unavailable</div>}
          </div>
        </section>
      </div>

      <section>
        <SectionLabel>Signals</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <SignalBadge label={indicators.rsSignal} />
          <SignalBadge label={indicators.trendDirection} />
          <SignalBadge label={indicators.volumeTrendSignal} />
          {indicators.rrgQuadrant && <SignalBadge label={indicators.rrgQuadrant} />}
          <SignalBadge label={indicators.renkoSignal} />
          {indicators.rrgTransition && <SignalBadge label={indicators.rrgTransition} tone="watch" />}
          {indicators.renkoReversalSignal && <SignalBadge label="Renko Reversal" tone="watch" />}
          {indicators.volumeSpike && <SignalBadge label="Volume Spike" tone="watch" />}
          {indicators.volumeExpansion && <SignalBadge label="Volume Expansion" tone="watch" />}
        </div>
      </section>

      <section>
        <SectionLabel>Ranking Breakdown</SectionLabel>
        <div className="overflow-hidden rounded-sm border border-line">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-raised">
                <Th>Component</Th>
                <Th>Score</Th>
                <Th>Weight</Th>
                <Th>Contribution</Th>
                <Th align="left">Why</Th>
              </tr>
            </thead>
            <tbody>
              {ranking.breakdown.map((item) => (
                <tr key={item.label} className="border-b border-line bg-surface last:border-b-0">
                  <td className="px-3 py-2 font-medium">{item.label}</td>
                  <td className="px-3 py-2">
                    <NumCell value={item.rawScore} decimals={0} />
                  </td>
                  <td className="px-3 py-2">
                    <NumCell value={item.weight} decimals={0} suffix="%" />
                  </td>
                  <td className="px-3 py-2">
                    <NumCell value={item.contribution} decimals={1} />
                  </td>
                  <td className="px-3 py-2 text-ink-muted">
                    <ul className="list-inside list-disc space-y-0.5">
                      {item.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-raised">
                <td className="px-3 py-2 font-medium" colSpan={3}>
                  Composite Score
                </td>
                <td className="px-3 py-2">
                  <NumCell value={ranking.compositeScore} decimals={0} />
                </td>
                <td className="px-3 py-2">
                  <SignalBadge label={ranking.compositeSignal} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[13px] font-medium text-ink-muted">{children}</h2>;
}

function Th({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}
