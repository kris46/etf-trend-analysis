import type { ExplainabilityResult, ExplainReason, SymbolIndicators, SymbolRanking } from "../../types/market";

/**
 * Six punchy, individually-bullish-or-not checks, matching the project
 * brief's example format exactly (RRG / RS / Renko / Volume / Delivery /
 * EMA200). `isBullish` is each check's own directional lean; whether that
 * counts as a "✓" depends on which way the overall signal points, handled
 * in buildExplainability below.
 */
function rawChecks(ind: SymbolIndicators): { text: string; isBullish: boolean }[] {
  return [
    {
      text: ind.rrgQuadrant ? `RRG ${ind.rrgQuadrant}` : "RRG Unavailable",
      isBullish: ind.rrgQuadrant === "Leading" || ind.rrgQuadrant === "Improving",
    },
    {
      text: `Relative Strength ${ind.rsTrend === "Bullish" ? "Rising" : ind.rsTrend === "Bearish" ? "Falling" : "Flat"}`,
      isBullish: ind.rsTrend === "Bullish",
    },
    {
      text: `${ind.renkoSignal} Renko`,
      isBullish: ind.renkoSignal === "Bullish",
    },
    {
      text: ind.volumeSpike ? "Volume Spike" : ind.volumeExpansion ? "Volume Expansion" : `Volume ${ind.volumeTrendSignal}`,
      isBullish: ind.volumeTrendSignal === "Accumulation" || ind.volumeSpike || ind.volumeExpansion,
    },
    {
      text: `Delivery ${ind.accumulationScore >= 50 ? "Accumulation" : "Distribution"}`,
      isBullish: ind.accumulationScore >= 50,
    },
    {
      text: ind.ema200 !== null ? `${ind.close >= ind.ema200 ? "Above" : "Below"} EMA200` : "EMA200 Unavailable",
      isBullish: ind.ema200 !== null && ind.close >= ind.ema200,
    },
  ];
}

function confidenceFor(ranking: SymbolRanking): number {
  if (ranking.compositeSignal === "BUY") return ranking.compositeScore;
  if (ranking.compositeSignal === "AVOID") return 100 - ranking.compositeScore;
  // WATCH is, by construction, the ambiguous middle -- report genuine uncertainty
  // rather than manufacturing false precision either side of it.
  return 50;
}

/**
 * The formal Explainability Engine: every signal shown in the UI should
 * come from this function. Never display a score without it.
 */
export function buildExplainability(ind: SymbolIndicators, ranking: SymbolRanking): ExplainabilityResult {
  const signal = ranking.compositeSignal;
  const checks = rawChecks(ind);

  const reasons: ExplainReason[] = checks.map(({ text, isBullish }) => ({
    text,
    supportsSignal: signal === "AVOID" ? !isBullish : isBullish,
  }));

  return {
    symbol: ind.symbol,
    signal,
    confidence: confidenceFor(ranking),
    reasons,
  };
}
