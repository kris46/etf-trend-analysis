import { create } from "zustand";
import { dataProvider } from "../lib/dataProvider";
import { computeSymbolIndicators } from "../lib/computeIndicators";
import { computeRankings, DEFAULT_WEIGHTS } from "../lib/ranking/compositeRanking";
import { computeRrgSeries } from "../lib/indicators/rrg";
import { computeRenko } from "../lib/indicators/renko";
import type {
  RankingWeights,
  RenkoResult,
  RrgSeries,
  SymbolIndicators,
  SymbolRanking,
  SymbolSeries,
} from "../types/market";

interface MarketState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  symbols: string[];
  seriesBySymbol: Record<string, SymbolSeries>;
  indicatorsBySymbol: Record<string, SymbolIndicators>;
  rankings: SymbolRanking[];
  rrgSeriesBySymbol: Record<string, RrgSeries>;
  renkoBySymbol: Record<string, RenkoResult>;

  benchmark: string;
  weights: RankingWeights;

  load: () => Promise<void>;
  setBenchmark: (symbol: string) => void;
  setWeights: (weights: RankingWeights) => void;
  getSeries: (symbol: string) => SymbolSeries | undefined;
  getIndicators: (symbol: string) => SymbolIndicators | undefined;
  getRanking: (symbol: string) => SymbolRanking | undefined;
  getRrgSeries: (symbol: string) => RrgSeries | undefined;
  getRenko: (symbol: string) => RenkoResult | undefined;
}

function recompute(
  seriesBySymbol: Record<string, SymbolSeries>,
  benchmark: string,
  weights: RankingWeights
): {
  indicatorsBySymbol: Record<string, SymbolIndicators>;
  rankings: SymbolRanking[];
  rrgSeriesBySymbol: Record<string, RrgSeries>;
  renkoBySymbol: Record<string, RenkoResult>;
} {
  const benchmarkSeries = seriesBySymbol[benchmark] ?? null;
  const indicatorsList: SymbolIndicators[] = [];
  const rrgSeriesBySymbol: Record<string, RrgSeries> = {};
  const renkoBySymbol: Record<string, RenkoResult> = {};

  for (const symbol of Object.keys(seriesBySymbol)) {
    try {
      indicatorsList.push(computeSymbolIndicators(seriesBySymbol[symbol], benchmarkSeries));
    } catch {
      // symbol had too few bars to compute indicators yet -- skip it rather than crash the dashboard
      continue;
    }

    renkoBySymbol[symbol] = computeRenko(symbol, seriesBySymbol[symbol].bars);

    if (benchmarkSeries && benchmarkSeries.symbol !== symbol) {
      rrgSeriesBySymbol[symbol] = computeRrgSeries(symbol, seriesBySymbol[symbol].bars, benchmark, benchmarkSeries.bars);
    }
  }

  const { rankings, universeWithRsRank } = computeRankings(indicatorsList, weights);
  const indicatorsBySymbol: Record<string, SymbolIndicators> = {};
  for (const ind of universeWithRsRank) indicatorsBySymbol[ind.symbol] = ind;

  return { indicatorsBySymbol, rankings, rrgSeriesBySymbol, renkoBySymbol };
}

export const useMarketStore = create<MarketState>((set, get) => ({
  status: "idle",
  error: null,

  symbols: [],
  seriesBySymbol: {},
  indicatorsBySymbol: {},
  rankings: [],
  rrgSeriesBySymbol: {},
  renkoBySymbol: {},

  benchmark: "NIFTYBEES",
  weights: DEFAULT_WEIGHTS,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const symbols = await dataProvider.getSymbols();
      const seriesList = await Promise.all(symbols.map((s) => dataProvider.getOhlcv(s)));
      const seriesBySymbol: Record<string, SymbolSeries> = {};
      for (const series of seriesList) seriesBySymbol[series.symbol] = series;

      const benchmark = symbols.includes("NIFTYBEES") ? "NIFTYBEES" : symbols[0];
      const { indicatorsBySymbol, rankings, rrgSeriesBySymbol, renkoBySymbol } = recompute(seriesBySymbol, benchmark, get().weights);

      set({ status: "ready", symbols, seriesBySymbol, benchmark, indicatorsBySymbol, rankings, rrgSeriesBySymbol, renkoBySymbol });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Failed to load market data" });
    }
  },

  setBenchmark: (symbol) => {
    const { seriesBySymbol, weights } = get();
    const { indicatorsBySymbol, rankings, rrgSeriesBySymbol, renkoBySymbol } = recompute(seriesBySymbol, symbol, weights);
    set({ benchmark: symbol, indicatorsBySymbol, rankings, rrgSeriesBySymbol, renkoBySymbol });
  },

  setWeights: (weights) => {
    const { seriesBySymbol, benchmark } = get();
    const { indicatorsBySymbol, rankings, rrgSeriesBySymbol, renkoBySymbol } = recompute(seriesBySymbol, benchmark, weights);
    set({ weights, indicatorsBySymbol, rankings, rrgSeriesBySymbol, renkoBySymbol });
  },

  getSeries: (symbol) => get().seriesBySymbol[symbol],
  getIndicators: (symbol) => get().indicatorsBySymbol[symbol],
  getRanking: (symbol) => get().rankings.find((r) => r.symbol === symbol),
  getRrgSeries: (symbol) => get().rrgSeriesBySymbol[symbol],
  getRenko: (symbol) => get().renkoBySymbol[symbol],
}));
