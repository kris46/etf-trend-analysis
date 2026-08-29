import type { SymbolIndicators, SymbolRanking } from "../../types/market";
import { buildExplainability } from "../explainability/explain";

/**
 * Turns the current snapshot into a compact text block the LLM can reason
 * over. Kept deliberately terse (one line per symbol) to control token
 * cost -- the assistant should answer from this, not from whatever it
 * happens to "remember" about these ETFs from training, which could be
 * stale or wrong.
 */
export function buildMarketContext(indicatorsBySymbol: Record<string, SymbolIndicators>, rankings: SymbolRanking[], benchmark: string): string {
  const lines: string[] = [];
  lines.push(`Benchmark: ${benchmark}`);
  lines.push(`As of: ${rankings[0] ? indicatorsBySymbol[rankings[0].symbol]?.asOf : "unknown"}`);
  lines.push("");
  lines.push("Ranked ETFs (rank, symbol, composite score/signal, then each component's score and the reason behind it):");

  rankings.forEach((ranking, i) => {
    const ind = indicatorsBySymbol[ranking.symbol];
    if (!ind) return;
    const explain = buildExplainability(ind, ranking);

    lines.push(
      `${i + 1}. ${ranking.symbol} -- score ${ranking.compositeScore}/100, signal ${ranking.compositeSignal}, confidence ${explain.confidence}, ` +
        `close ${ind.close.toFixed(2)} (${ind.changePct >= 0 ? "+" : ""}${ind.changePct.toFixed(2)}% today)`
    );
    for (const b of ranking.breakdown) {
      lines.push(`   - ${b.label}: ${b.rawScore}/100 (weight ${b.weight}%) -- ${b.reasons.join("; ")}`);
    }
  });

  return lines.join("\n");
}

export const ASSISTANT_SYSTEM_PROMPT = `You are the Research Assistant for an NSE ETF swing-trading research platform.
Answer questions ONLY using the market data context provided in each message -- it reflects this platform's own
indicator/ranking/RRG/Renko engines as of today, computed moments ago. Do not rely on general knowledge about these
specific ETFs (your training data may be stale or wrong about current prices/conditions) -- if the context doesn't
contain what's needed to answer, say so plainly rather than guessing. Be concise and concrete: cite the actual
numbers and reasons from the context (e.g. "CPSEETF ranks last because its RRG quadrant is Lagging and RS is
-4.6% vs benchmark"). You are not a financial advisor and should not tell the user what to do with their money --
explain what the data shows, not what they should decide.`;
