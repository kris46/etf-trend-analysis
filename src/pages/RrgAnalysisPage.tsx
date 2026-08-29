import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMarketStore } from "../store/useMarketStore";
import { RrgChart } from "../components/charts/RrgChart";
import { PerformanceComparisonChart } from "../components/charts/PerformanceComparisonChart";
import { computePerformanceComparison, cutoffDateFor, WINDOW_OPTIONS } from "../lib/performanceComparison";

const TRAIL_OPTIONS = [5, 10, 15, 20, 40];
const PLAY_INTERVAL_MS = 220;

export function RrgAnalysisPage() {
  const navigate = useNavigate();
  const symbols = useMarketStore((s) => s.symbols);
  const benchmark = useMarketStore((s) => s.benchmark);
  const setBenchmark = useMarketStore((s) => s.setBenchmark);
  const rrgSeriesBySymbol = useMarketStore((s) => s.rrgSeriesBySymbol);
  const seriesBySymbol = useMarketStore((s) => s.seriesBySymbol);

  // Includes the benchmark itself -- the Performance Comparison tab has no
  // mathematical need to exclude it (unlike RRG, which can't compare a
  // symbol to itself). On the Scatter tab, selecting the benchmark is a
  // harmless no-op: there's no RRG series for it, so it's silently skipped.
  const candidates = useMemo(() => symbols, [symbols]);
  const [selected, setSelected] = useState<string[]>(candidates);
  useEffect(() => setSelected(candidates), [candidates.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const [trailLength, setTrailLength] = useState(15);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"scatter" | "performance">("scatter");
  const [windowDays, setWindowDays] = useState<number>(15);

  const seriesList = useMemo(
    () => selected.map((s) => rrgSeriesBySymbol[s]).filter((s): s is NonNullable<typeof s> => !!s && s.points.length > 0),
    [selected, rrgSeriesBySymbol]
  );

  const timeline = useMemo(() => {
    const dateSet = new Set<string>();
    for (const series of seriesList) for (const p of series.points) dateSet.add(p.date);
    return Array.from(dateSet).sort();
  }, [seriesList]);

  // keep the replay cursor pinned to "today" whenever the underlying data changes,
  // unless the user has manually scrubbed backward.
  useEffect(() => {
    setReplayIndex(timeline.length - 1);
  }, [timeline.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setReplayIndex((i) => {
        if (i >= timeline.length - 1) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, timeline.length]);

  const asOfDate = timeline[replayIndex] ?? timeline[timeline.length - 1];

  // "today" for the performance window = the latest date available across the selected symbols.
  const performanceSeriesList = useMemo(() => {
    let latest = "";
    for (const s of selected) {
      const bars = seriesBySymbol[s]?.bars;
      if (bars && bars.length > 0 && bars[bars.length - 1].Date > latest) latest = bars[bars.length - 1].Date;
    }
    if (!latest) return [];
    const cutoff = cutoffDateFor(latest, windowDays);
    return computePerformanceComparison(seriesBySymbol, selected, cutoff);
  }, [selected, seriesBySymbol, windowDays]);

  function togglePlay() {
    if (!isPlaying && replayIndex >= timeline.length - 1) setReplayIndex(0);
    setIsPlaying((p) => !p);
  }

  function toggleSymbol(symbol: string) {
    setSelected((curr) => (curr.includes(symbol) ? curr.filter((s) => s !== symbol) : [...curr, symbol]));
  }

  function toggleAll() {
    setSelected((curr) => (curr.length === candidates.length ? [] : candidates));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold">RRG Analysis</h1>
          <p className="text-sm text-ink-muted">
            {viewMode === "scatter" ? (
              <>
                Relative Rotation Graph vs <span className="text-ink">{benchmark}</span> — click a point to open that ETF
              </>
            ) : (
              "% return comparison since the start of the selected window — click a line to open that ETF"
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          Benchmark
          <select
            value={benchmark}
            onChange={(e) => setBenchmark(e.target.value)}
            className="rounded-sm border border-line bg-surface-raised px-2 py-1 font-mono text-xs text-ink outline-none focus-visible:border-signal"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => setViewMode("scatter")}
          className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${
            viewMode === "scatter" ? "border-signal bg-signal-bg text-signal" : "border-line text-ink-muted hover:text-ink"
          }`}
        >
          RRG Scatter
        </button>
        <button
          onClick={() => setViewMode("performance")}
          className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${
            viewMode === "performance" ? "border-signal bg-signal-bg text-signal" : "border-line text-ink-muted hover:text-ink"
          }`}
        >
          Performance Comparison
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
        <div className="h-[560px] rounded-sm border border-line bg-surface p-2">
          {viewMode === "scatter" ? (
            seriesList.length > 0 ? (
              <RrgChart seriesList={seriesList} asOfDate={asOfDate} trailLength={trailLength} onSelectSymbol={(s) => navigate(`/etf/${s}`)} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                Not enough history yet to compute RRG for these symbols vs {benchmark}
              </div>
            )
          ) : performanceSeriesList.length > 0 ? (
            <PerformanceComparisonChart seriesList={performanceSeriesList} onSelectSymbol={(s) => navigate(`/etf/${s}`)} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">Select at least one symbol</div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {viewMode === "scatter" ? (
            <div className="rounded-sm border border-line bg-surface p-3">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Trail length</div>
              <div className="flex flex-wrap gap-1">
                {TRAIL_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setTrailLength(n)}
                    className={`rounded-sm border px-2 py-1 text-xs font-mono ${
                      trailLength === n ? "border-signal bg-signal-bg text-signal" : "border-line text-ink-muted hover:text-ink"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-sm border border-line bg-surface p-3">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Window</div>
              <div className="flex flex-wrap gap-1">
                {WINDOW_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setWindowDays(opt.days)}
                    className={`rounded-sm border px-2 py-1 text-xs font-mono ${
                      windowDays === opt.days ? "border-signal bg-signal-bg text-signal" : "border-line text-ink-muted hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-sm border border-line bg-surface p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Symbols</div>
            <label className="mb-1.5 flex items-center gap-2 border-b border-line pb-1.5 text-[13px] font-medium">
              <input type="checkbox" checked={selected.length === candidates.length && candidates.length > 0} onChange={toggleAll} className="accent-signal" />
              Select all
            </label>
            <div className="flex flex-col gap-1.5">
              {candidates.map((s) => (
                <label key={s} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={selected.includes(s)} onChange={() => toggleSymbol(s)} className="accent-signal" />
                  {s}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {viewMode === "scatter" && (
        <div className="rounded-sm border border-line bg-surface p-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-ink-muted">
            <span>Historical Replay</span>
            <span className="num text-ink">{asOfDate}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="rounded-sm border border-line bg-surface-raised px-3 py-1 text-xs font-medium text-ink hover:border-signal hover:text-signal"
              disabled={timeline.length < 2}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, timeline.length - 1)}
              value={replayIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setReplayIndex(Number(e.target.value));
              }}
              className="w-full accent-signal"
            />
          </div>
        </div>
      )}
    </div>
  );
}
