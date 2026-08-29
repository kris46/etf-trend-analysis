import type { SymbolIndicators, SymbolRanking } from "../types/market";

export type NotificationType = "renko_reversal" | "rrg_transition" | "volume_spike" | "volume_expansion" | "buy_signal";

export interface Notification {
  id: string;
  symbol: string;
  type: NotificationType;
  message: string;
  severity: "info" | "bull" | "bear";
}

/**
 * There's no persistence in this app (by design, see Phase 1 decisions), so
 * "notifications" here means "today's notable events" -- not "new since you
 * last looked," which would need to remember a prior visit. Renko reversals
 * and volume spikes/expansion are genuinely today's events; RRG transitions
 * use a 5-session lookback (same window the RRG engine itself uses) so it
 * can still be "recent" a few days after the actual crossing.
 */
export function computeNotifications(indicatorsBySymbol: Record<string, SymbolIndicators>, rankings: SymbolRanking[]): Notification[] {
  const notifications: Notification[] = [];
  const rankBySymbol = new Map(rankings.map((r) => [r.symbol, r]));

  for (const symbol of Object.keys(indicatorsBySymbol)) {
    const ind = indicatorsBySymbol[symbol];

    if (ind.renkoReversalSignal) {
      notifications.push({
        id: `${symbol}-renko`,
        symbol,
        type: "renko_reversal",
        message: `${symbol}: fresh Renko reversal to ${ind.renkoSignal}`,
        severity: ind.renkoSignal === "Bullish" ? "bull" : "bear",
      });
    }

    if (ind.rrgTransition) {
      notifications.push({
        id: `${symbol}-rrg`,
        symbol,
        type: "rrg_transition",
        message: `${symbol}: RRG ${ind.rrgTransition} (last 5 sessions)`,
        severity: ind.rrgTransition.endsWith("Leading") || ind.rrgTransition.endsWith("Improving") ? "bull" : "bear",
      });
    }

    if (ind.volumeSpike) {
      notifications.push({
        id: `${symbol}-volspike`,
        symbol,
        type: "volume_spike",
        message: `${symbol}: volume spike vs 20-day average`,
        severity: "info",
      });
    } else if (ind.volumeExpansion) {
      notifications.push({
        id: `${symbol}-volexp`,
        symbol,
        type: "volume_expansion",
        message: `${symbol}: volume expansion building`,
        severity: "info",
      });
    }

    const ranking = rankBySymbol.get(symbol);
    if (ranking?.compositeSignal === "BUY") {
      notifications.push({
        id: `${symbol}-buy`,
        symbol,
        type: "buy_signal",
        message: `${symbol}: rated BUY today (score ${ranking.compositeScore}/100)`,
        severity: "bull",
      });
    }
  }

  // most actionable first: reversals and transitions before steady-state BUY ratings
  const priority: Record<NotificationType, number> = { renko_reversal: 0, rrg_transition: 1, volume_spike: 2, volume_expansion: 3, buy_signal: 4 };
  notifications.sort((a, b) => priority[a.type] - priority[b.type]);

  return notifications;
}
