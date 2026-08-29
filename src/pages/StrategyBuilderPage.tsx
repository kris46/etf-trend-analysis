import { useMemo, useRef, useState } from "react";
import { useMarketStore } from "../store/useMarketStore";
import { runBacktest } from "../lib/backtest/runBacktest";
import { FIELD_REGISTRY } from "../lib/backtest/fields";
import { ConditionRow } from "../components/strategy/ConditionRow";
import { BacktestStatsGrid } from "../components/strategy/BacktestStatsGrid";
import { TradesTable } from "../components/strategy/TradesTable";
import { EquityCurveChart } from "../components/charts/EquityCurveChart";
import type { BacktestConfig, BacktestResult, Strategy, StrategyCondition } from "../types/market";

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultStrategy(): Strategy {
  return {
    id: newId(),
    name: "RRG Leading + Bullish Renko + Volume Spike",
    conditions: [
      { id: newId(), field: "rrgQuadrant", operator: "equals", value: "Leading", weight: 25 },
      { id: newId(), field: "renkoSignal", operator: "equals", value: "Bullish", weight: 25 },
      { id: newId(), field: "volumeSpike", operator: "isTrue", value: true, weight: 25 },
      { id: newId(), field: "rsTrend", operator: "equals", value: "Bullish", weight: 25 },
    ],
    entryThreshold: 75,
    holdingPeriodDays: 15,
  };
}

export function StrategyBuilderPage() {
  const status = useMarketStore((s) => s.status);
  const symbols = useMarketStore((s) => s.symbols);
  const seriesBySymbol = useMarketStore((s) => s.seriesBySymbol);
  const benchmark = useMarketStore((s) => s.benchmark);

  const [strategies, setStrategies] = useState<Strategy[]>(() => [defaultStrategy()]);
  const [selectedId, setSelectedId] = useState<string>(() => strategies[0].id);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, BacktestResult>>({});
  const [mode, setMode] = useState<"single" | "compare">("single");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const benchmarkBars = seriesBySymbol[benchmark]?.bars ?? [];
  const earliestDate = benchmarkBars[0]?.Date ?? "2015-01-01";
  const latestDate = benchmarkBars.at(-1)?.Date ?? "2026-01-01";
  const defaultStart = useMemo(() => {
    const d = new Date(latestDate);
    d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().slice(0, 10);
  }, [latestDate]);

  const [config, setConfig] = useState<BacktestConfig>(() => ({
    universe: symbols.filter((s) => s !== benchmark),
    benchmark,
    startDate: defaultStart,
    endDate: latestDate,
    startingCapital: 100000,
    positionSizePct: 10,
    costBps: 5,
    slippageBps: 5,
  }));

  const selected = strategies.find((s) => s.id === selectedId) ?? strategies[0];

  function updateSelected(patch: Partial<Strategy>) {
    setStrategies((curr) => curr.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));
  }

  function updateCondition(condId: string, next: StrategyCondition) {
    updateSelected({ conditions: selected.conditions.map((c) => (c.id === condId ? next : c)) });
  }

  function addCondition() {
    const field = FIELD_REGISTRY[0];
    updateSelected({
      conditions: [...selected.conditions, { id: newId(), field: field.key, operator: "equals", value: field.options?.[0] ?? 0, weight: 25 }],
    });
  }

  function addStrategy() {
    const s = { ...defaultStrategy(), id: newId(), name: "New Strategy" };
    setStrategies((curr) => [...curr, s]);
    setSelectedId(s.id);
  }

  function duplicateStrategy() {
    const copy: Strategy = { ...selected, id: newId(), name: `${selected.name} (copy)`, conditions: selected.conditions.map((c) => ({ ...c, id: newId() })) };
    setStrategies((curr) => [...curr, copy]);
    setSelectedId(copy.id);
  }

  function deleteStrategy(id: string) {
    setStrategies((curr) => {
      const next = curr.filter((s) => s.id !== id);
      return next.length > 0 ? next : [defaultStrategy()];
    });
    setCompareIds((curr) => {
      const next = new Set(curr);
      next.delete(id);
      return next;
    });
    if (selectedId === id) {
      setSelectedId((strategies.find((s) => s.id !== id) ?? defaultStrategy()).id);
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runSingle() {
    const result = runBacktest(selected, config, seriesBySymbol);
    setResults((curr) => ({ ...curr, [selected.id]: result }));
    setMode("single");
  }

  function runComparison() {
    const targets = strategies.filter((s) => compareIds.has(s.id));
    const newResults: Record<string, BacktestResult> = {};
    for (const s of targets) newResults[s.id] = runBacktest(s, config, seriesBySymbol);
    setResults((curr) => ({ ...curr, ...newResults }));
    setMode("compare");
  }

  function exportStrategies() {
    const blob = new Blob([JSON.stringify(strategies, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "etf-strategies.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importStrategies(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported: Strategy[] = Array.isArray(parsed) ? parsed : [parsed];
        const withFreshIds = imported.map((s) => ({ ...s, id: newId() }));
        setStrategies((curr) => [...curr, ...withFreshIds]);
        if (withFreshIds[0]) setSelectedId(withFreshIds[0].id);
      } catch {
        alert("Couldn't read that file -- expected JSON exported from this page.");
      }
    };
    reader.readAsText(file);
  }

  if (status !== "ready") {
    return <div className="text-sm text-ink-muted">Loading…</div>;
  }

  const singleResult = results[selected.id];
  const compareTargets = strategies.filter((s) => compareIds.has(s.id) && results[s.id]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-lg font-semibold">Strategy Builder &amp; Backtesting</h1>
        <p className="text-sm text-ink-muted">
          No-code rules over the same signals the dashboard shows — RRG, RS, Renko, Volume, Delivery. Strategies live for this session only
          (export to a file if you want to keep one).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* Strategy list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Strategies</span>
            <button onClick={addStrategy} className="text-xs text-signal hover:underline">
              + New
            </button>
          </div>

          {strategies.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`cursor-pointer rounded-sm border p-2.5 text-[13px] ${
                s.id === selectedId ? "border-signal bg-signal-bg" : "border-line bg-surface hover:bg-surface-raised"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={compareIds.has(s.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleCompare(s.id);
                  }}
                  className="accent-signal"
                />
                <span className="flex-1 truncate font-medium text-ink">{s.name}</span>
              </div>
              <div className="mt-1 text-[11px] text-ink-muted">
                {s.conditions.length} condition{s.conditions.length === 1 ? "" : "s"} · ≥{s.entryThreshold}% · hold {s.holdingPeriodDays}d
              </div>
            </div>
          ))}

          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <button onClick={exportStrategies} className="text-ink-muted hover:text-ink">
              Export all
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="text-ink-muted hover:text-ink">
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importStrategies(file);
                e.target.value = "";
              }}
            />
          </div>

          {compareIds.size >= 2 && (
            <button onClick={runComparison} className="mt-2 rounded-sm border border-signal bg-signal-bg px-3 py-1.5 text-xs font-medium text-signal hover:bg-signal/20">
              Compare {compareIds.size} strategies
            </button>
          )}
        </div>

        {/* Editor + config + results */}
        <div className="flex flex-col gap-4">
          <div className="rounded-sm border border-line bg-surface p-3">
            <div className="mb-3 flex items-center justify-between">
              <input
                value={selected.name}
                onChange={(e) => updateSelected({ name: e.target.value })}
                className="rounded-sm border border-transparent bg-transparent px-1 text-[15px] font-medium text-ink outline-none hover:border-line focus-visible:border-signal"
              />
              <div className="flex gap-2 text-xs">
                <button onClick={duplicateStrategy} className="text-ink-muted hover:text-ink">
                  Duplicate
                </button>
                <button onClick={() => deleteStrategy(selected.id)} className="text-ink-muted hover:text-bear">
                  Delete
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {selected.conditions.map((c) => (
                <ConditionRow
                  key={c.id}
                  condition={c}
                  onChange={(next) => updateCondition(c.id, next)}
                  onDelete={() => updateSelected({ conditions: selected.conditions.filter((x) => x.id !== c.id) })}
                />
              ))}
              <button onClick={addCondition} className="self-start text-xs text-signal hover:underline">
                + Add condition
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-5">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Entry threshold: {selected.entryThreshold}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selected.entryThreshold}
                  onChange={(e) => updateSelected({ entryThreshold: Number(e.target.value) })}
                  className="w-44 accent-signal"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Holding period (days)</span>
                <input
                  type="number"
                  min={1}
                  value={selected.holdingPeriodDays}
                  onChange={(e) => updateSelected({ holdingPeriodDays: Number(e.target.value) })}
                  className="num w-20 rounded-sm border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
                />
              </label>
            </div>
          </div>

          {/* Backtest config */}
          <div className="rounded-sm border border-line bg-surface p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Backtest configuration (shared across strategies)</div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-muted">Start date</span>
                <input
                  type="date"
                  min={earliestDate}
                  max={config.endDate}
                  value={config.startDate}
                  onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                  className="num rounded-sm border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-muted">End date</span>
                <input
                  type="date"
                  min={config.startDate}
                  max={latestDate}
                  value={config.endDate}
                  onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                  className="num rounded-sm border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-muted">Starting capital</span>
                <input
                  type="number"
                  value={config.startingCapital}
                  onChange={(e) => setConfig({ ...config, startingCapital: Number(e.target.value) })}
                  className="num w-28 rounded-sm border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-muted">Position size %/trade</span>
                <input
                  type="number"
                  value={config.positionSizePct}
                  onChange={(e) => setConfig({ ...config, positionSizePct: Number(e.target.value) })}
                  className="num w-20 rounded-sm border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-muted">Cost (bps/side)</span>
                <input
                  type="number"
                  value={config.costBps}
                  onChange={(e) => setConfig({ ...config, costBps: Number(e.target.value) })}
                  className="num w-16 rounded-sm border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-muted">Slippage (bps/side)</span>
                <input
                  type="number"
                  value={config.slippageBps}
                  onChange={(e) => setConfig({ ...config, slippageBps: Number(e.target.value) })}
                  className="num w-16 rounded-sm border border-line bg-surface-raised px-2 py-1 text-xs text-ink"
                />
              </label>
            </div>
            <div className="mt-3">
              <div className="mb-1 text-[11px] text-ink-muted">Universe</div>
              <div className="flex flex-wrap gap-3">
                {symbols
                  .filter((s) => s !== config.benchmark)
                  .map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-[13px]">
                      <input
                        type="checkbox"
                        checked={config.universe.includes(s)}
                        onChange={(e) =>
                          setConfig({ ...config, universe: e.target.checked ? [...config.universe, s] : config.universe.filter((u) => u !== s) })
                        }
                        className="accent-signal"
                      />
                      {s}
                    </label>
                  ))}
              </div>
            </div>
            <button onClick={runSingle} className="mt-3 rounded-sm border border-signal bg-signal-bg px-4 py-1.5 text-xs font-medium text-signal hover:bg-signal/20">
              Run Backtest
            </button>
          </div>

          {/* Results */}
          {mode === "single" && singleResult && (
            <div className="flex flex-col gap-4">
              <BacktestStatsGrid stats={singleResult.stats} />
              <div className="rounded-sm border border-line bg-surface p-2">
                <EquityCurveChart curves={[{ label: selected.name, points: singleResult.equityCurve }]} />
              </div>
              <TradesTable trades={singleResult.trades} />
            </div>
          )}

          {mode === "compare" && compareTargets.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-sm border border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-raised">
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted">Strategy</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">Trades</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">Win Rate</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">Profit Factor</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">Avg Return</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">Max DD</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">Total Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareTargets.map((s) => {
                      const r = results[s.id];
                      return (
                        <tr key={s.id} className="border-b border-line bg-surface last:border-b-0">
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="num px-3 py-2 text-right">{r.stats.totalTrades}</td>
                          <td className="num px-3 py-2 text-right">{r.stats.winRate.toFixed(1)}%</td>
                          <td className="num px-3 py-2 text-right">{r.stats.profitFactor === null ? "∞" : r.stats.profitFactor.toFixed(2)}</td>
                          <td className="num px-3 py-2 text-right">{r.stats.averageReturnPct.toFixed(2)}%</td>
                          <td className="num px-3 py-2 text-right">{r.stats.maxDrawdownPct.toFixed(2)}%</td>
                          <td className="num px-3 py-2 text-right">{r.stats.totalReturnPct.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="rounded-sm border border-line bg-surface p-2">
                <EquityCurveChart curves={compareTargets.map((s) => ({ label: s.name, points: results[s.id].equityCurve }))} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
