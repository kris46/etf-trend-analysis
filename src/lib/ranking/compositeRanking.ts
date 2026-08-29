import type {
  RankingWeights,
  SymbolIndicators,
  SymbolRanking,
  CompositeSignal,
  RankingBreakdownItem,
  RrgQuadrant,
} from "../../types/market";
import { clamp } from "../indicators/trend";

/**
 * Full spec weights, now that RRG and Renko both exist (Phase 2). Matches
 * the project brief exactly: RRG 25 / RS 25 / Renko 15 / Volume 10 /
 * Delivery 15 / Trend 10.
 */
export const DEFAULT_WEIGHTS: RankingWeights = {
  rrg: 25,
  relativeStrength: 25,
  renko: 15,
  volume: 10,
  delivery: 15,
  trend: 10,
};

function percentileRanks(values: (number | null)[]): (number | null)[] {
  const valid = values.filter((v): v is number => v !== null);
  return values.map((v) => {
    if (v === null) return null;
    const below = valid.filter((x) => x <= v).length;
    return Math.round((below / valid.length) * 100);
  });
}

function volumeComponentScore(ind: SymbolIndicators): number {
  let score = 50;
  if (ind.volumeTrendSignal === "Accumulation") score += 25;
  if (ind.volumeTrendSignal === "Distribution") score -= 25;
  if (ind.volumeSpike) score += 10;
  if (ind.volumeExpansion) score += 10;
  return clamp(score, 0, 100);
}

function deliveryComponentScore(ind: SymbolIndicators): number {
  let score = ind.accumulationScore; // already 0-100, higher = more accumulation-like
  if (ind.deliveryTrend === "Rising") score += 5;
  if (ind.deliveryTrend === "Falling") score -= 5;
  return clamp(score, 0, 100);
}

const RRG_BASE_SCORE: Record<RrgQuadrant, number> = {
  Leading: 85,
  Improving: 65,
  Weakening: 40,
  Lagging: 15,
};

function rrgComponentScore(ind: SymbolIndicators): number {
  if (ind.rrgQuadrant === null) return 50; // no benchmark overlap / insufficient history yet
  let score = RRG_BASE_SCORE[ind.rrgQuadrant];
  if (ind.rrgTransition) {
    const movingUp = ind.rrgTransition.endsWith("Leading") || ind.rrgTransition.endsWith("Improving");
    score += movingUp ? 10 : -10;
  }
  return clamp(score, 0, 100);
}

function renkoComponentScore(ind: SymbolIndicators): number {
  if (ind.renkoSignal === "Neutral") return 50;
  let score = ind.renkoSignal === "Bullish" ? 50 + ind.renkoTrendStrength / 2 : 50 - ind.renkoTrendStrength / 2;
  if (ind.renkoReversalSignal) score += ind.renkoSignal === "Bullish" ? 10 : -10;
  return clamp(score, 0, 100);
}

function compositeSignalFor(score: number): CompositeSignal {
  if (score >= 65) return "BUY";
  if (score >= 40) return "WATCH";
  return "AVOID";
}

function reasonsFor(ind: SymbolIndicators, rsScore: number, trendScore: number) {
  return {
    rrg: [
      ind.rrgQuadrant
        ? `RRG quadrant: ${ind.rrgQuadrant}`
        : "RRG unavailable (no benchmark overlap or insufficient history)",
      ind.rrgTransition ? `Transition: ${ind.rrgTransition} over the last 5 sessions` : "No quadrant change in the last 5 sessions",
    ],
    rs: [
      ind.rsRoc !== null
        ? `RS ${ind.rsRoc >= 0 ? "+" : ""}${ind.rsRoc.toFixed(1)}% vs benchmark over last 20 sessions (rank ${rsScore}/100)`
        : "Relative strength unavailable (no benchmark overlap)",
      `RS trend: ${ind.rsTrend}`,
    ],
    renko: [
      `Renko: ${ind.renkoSignal} for ${ind.renkoTrendAge} consecutive brick${ind.renkoTrendAge === 1 ? "" : "s"} (strength ${ind.renkoTrendStrength}/100)`,
      ind.renkoReversalSignal
        ? "Fresh Renko reversal on the latest brick"
        : `Brick count (last 50): ${ind.renkoBullishBrickCount} bullish / ${ind.renkoBearishBrickCount} bearish`,
    ],
    volume: [
      `Volume signal: ${ind.volumeTrendSignal}`,
      ind.volumeSpike ? "Volume spike vs 20-day average" : ind.volumeExpansion ? "Volume expansion building" : "No unusual volume",
    ],
    delivery: [`Delivery: ${ind.accumulationScore}/100 accumulation-leaning, trend ${ind.deliveryTrend}`],
    trend: [
      `Trend: ${ind.trendDirection} (strength ${trendScore}/100)`,
      ind.ema200 !== null ? `Price ${ind.close >= ind.ema200 ? "above" : "below"} EMA200` : "EMA200 not yet available (insufficient history)",
    ],
  };
}

/**
 * Computes composite ranking for every symbol in the universe, including
 * cross-sectional RS Rank (percentile of rsRoc across the same universe).
 */
export function computeRankings(
  universe: SymbolIndicators[],
  weights: RankingWeights = DEFAULT_WEIGHTS
): { rankings: SymbolRanking[]; universeWithRsRank: SymbolIndicators[] } {
  const rsRocValues = universe.map((u) => u.rsRoc);
  const rsRanks = percentileRanks(rsRocValues);

  const universeWithRsRank = universe.map((u, i) => ({ ...u, rsRank: rsRanks[i] }));

  const weightTotal =
    weights.rrg + weights.relativeStrength + weights.renko + weights.volume + weights.delivery + weights.trend || 1;

  const rankings: SymbolRanking[] = universeWithRsRank.map((ind) => {
    const rrgScore = rrgComponentScore(ind);
    const rsScore = ind.rsRank ?? 50;
    const renkoScore = renkoComponentScore(ind);
    const volScore = volumeComponentScore(ind);
    const delivScore = deliveryComponentScore(ind);
    const trendScore = ind.trendStrength;
    const reasons = reasonsFor(ind, rsScore, trendScore);

    const breakdown: RankingBreakdownItem[] = [
      { label: "RRG", rawScore: rrgScore, weight: weights.rrg, contribution: (rrgScore * weights.rrg) / weightTotal, reasons: reasons.rrg },
      {
        label: "Relative Strength",
        rawScore: rsScore,
        weight: weights.relativeStrength,
        contribution: (rsScore * weights.relativeStrength) / weightTotal,
        reasons: reasons.rs,
      },
      {
        label: "Renko",
        rawScore: renkoScore,
        weight: weights.renko,
        contribution: (renkoScore * weights.renko) / weightTotal,
        reasons: reasons.renko,
      },
      {
        label: "Volume",
        rawScore: volScore,
        weight: weights.volume,
        contribution: (volScore * weights.volume) / weightTotal,
        reasons: reasons.volume,
      },
      {
        label: "Delivery",
        rawScore: delivScore,
        weight: weights.delivery,
        contribution: (delivScore * weights.delivery) / weightTotal,
        reasons: reasons.delivery,
      },
      {
        label: "Trend",
        rawScore: trendScore,
        weight: weights.trend,
        contribution: (trendScore * weights.trend) / weightTotal,
        reasons: reasons.trend,
      },
    ];

    const compositeScore = Math.round(breakdown.reduce((sum, b) => sum + b.contribution, 0));

    return {
      symbol: ind.symbol,
      compositeScore: clamp(compositeScore, 0, 100),
      compositeSignal: compositeSignalFor(compositeScore),
      breakdown,
    };
  });

  rankings.sort((a, b) => b.compositeScore - a.compositeScore);

  return { rankings, universeWithRsRank };
}
