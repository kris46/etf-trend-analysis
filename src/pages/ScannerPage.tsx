import { useMemo, useState } from "react";
import { useMarketStore } from "../store/useMarketStore";
import { RankingTable, type RankRow } from "../components/common/RankingTable";
import type { RrgQuadrant, RenkoSignal, TrendSignal } from "../types/market";

const ALL = "All";

export function ScannerPage() {
  const status = useMarketStore((s) => s.status);
  const rankings = useMarketStore((s) => s.rankings);
  const indicatorsBySymbol = useMarketStore((s) => s.indicatorsBySymbol);

  const [minScore, setMinScore] = useState(0);
  const [rrgFilter, setRrgFilter] = useState<RrgQuadrant | typeof ALL>(ALL);
  const [rsTrendFilter, setRsTrendFilter] = useState<TrendSignal | typeof ALL>(ALL);
  const [renkoFilter, setRenkoFilter] = useState<RenkoSignal | typeof ALL>(ALL);
  const [volumeExpansionOnly, setVolumeExpansionOnly] = useState(false);
  const [accumulationOnly, setAccumulationOnly] = useState(false);

  const rows: RankRow[] = useMemo(() => {
    const all = rankings.map((ranking, i) => ({ rank: i + 1, ranking, indicators: indicatorsBySymbol[ranking.symbol] }));

    return all
      .filter((r) => r.indicators)
      .filter((r) => r.ranking.compositeScore >= minScore)
      .filter((r) => rrgFilter === ALL || r.indicators.rrgQuadrant === rrgFilter)
      .filter((r) => rsTrendFilter === ALL || r.indicators.rsTrend === rsTrendFilter)
      .filter((r) => renkoFilter === ALL || r.indicators.renkoSignal === renkoFilter)
      .filter((r) => !volumeExpansionOnly || r.indicators.volumeExpansion)
      .filter((r) => !accumulationOnly || r.indicators.volumeTrendSignal === "Accumulation" || r.indicators.accumulationScore >= 60)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rankings, indicatorsBySymbol, minScore, rrgFilter, rsTrendFilter, renkoFilter, volumeExpansionOnly, accumulationOnly]);

  if (status !== "ready") {
    return <div className="text-sm text-ink-muted">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-semibold">Opportunity Scanner</h1>
        <p className="text-sm text-ink-muted">
          {rows.length} / {rankings.length} ETFs match current filters
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-sm border border-line bg-surface p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Min score: {minScore}</span>
          <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-36 accent-signal" />
        </div>

        <FilterSelect label="RRG Quadrant" value={rrgFilter} onChange={setRrgFilter} options={["Leading", "Improving", "Weakening", "Lagging"]} />
        <FilterSelect label="RS Trend" value={rsTrendFilter} onChange={setRsTrendFilter} options={["Bullish", "Neutral", "Bearish"]} />
        <FilterSelect label="Renko Direction" value={renkoFilter} onChange={setRenkoFilter} options={["Bullish", "Bearish", "Neutral"]} />

        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={volumeExpansionOnly} onChange={(e) => setVolumeExpansionOnly(e.target.checked)} className="accent-signal" />
          Volume Expansion
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={accumulationOnly} onChange={(e) => setAccumulationOnly(e.target.checked)} className="accent-signal" />
          Accumulation
        </label>
      </div>

      <RankingTable rows={rows} />
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | typeof ALL;
  onChange: (v: T | typeof ALL) => void;
  options: T[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | typeof ALL)}
        className="rounded-sm border border-line bg-surface-raised px-2 py-1 font-mono text-xs text-ink outline-none focus-visible:border-signal"
      >
        <option value={ALL}>All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
