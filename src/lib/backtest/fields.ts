import type { BacktestSnapshot, StrategyCondition, StrategyFieldType } from "../../types/market";

export interface FieldDef {
  key: string;
  label: string;
  type: StrategyFieldType;
  options?: string[]; // for type === "enum"
  accessor: (snap: BacktestSnapshot) => number | boolean | string | null;
}

/**
 * Every condition a strategy can be built from. This list is what drives
 * the no-code builder UI (it picks the right control -- dropdown, number
 * input, true/false toggle -- from `type`), and it's also the only place
 * that knows how to read a field off a snapshot, so the UI and the engine
 * can never disagree about what a field means.
 */
export const FIELD_REGISTRY: FieldDef[] = [
  { key: "rrgQuadrant", label: "RRG Quadrant", type: "enum", options: ["Leading", "Improving", "Weakening", "Lagging"], accessor: (s) => s.rrgQuadrant },
  { key: "rsTrend", label: "RS Trend", type: "enum", options: ["Bullish", "Neutral", "Bearish"], accessor: (s) => s.rsTrend },
  { key: "rsSignal", label: "RS Signal", type: "enum", options: ["BUY", "WATCH", "SELL"], accessor: (s) => s.rsSignal },
  { key: "rsRoc", label: "RS Rate of Change (20d %)", type: "number", accessor: (s) => s.rsRoc },
  { key: "rsRank", label: "RS Rank (percentile)", type: "number", accessor: (s) => s.rsRank },
  { key: "rs", label: "Relative Strength (rebased, 100 = window start)", type: "number", accessor: (s) => s.rs },
  { key: "renkoSignal", label: "Renko Signal", type: "enum", options: ["Bullish", "Bearish", "Neutral"], accessor: (s) => s.renkoSignal },
  { key: "renkoTrendAge", label: "Renko Trend Age (bricks)", type: "number", accessor: (s) => s.renkoTrendAge },
  { key: "renkoReversalSignal", label: "Renko Fresh Reversal", type: "boolean", accessor: (s) => s.renkoReversalSignal },
  { key: "trendDirection", label: "Trend Direction (EMA stack)", type: "enum", options: ["Bullish", "Neutral", "Bearish"], accessor: (s) => s.trendDirection },
  { key: "trendStrength", label: "Trend Strength (0-100)", type: "number", accessor: (s) => s.trendStrength },
  { key: "volumeTrendSignal", label: "Volume Signal", type: "enum", options: ["Accumulation", "Distribution", "Neutral"], accessor: (s) => s.volumeTrendSignal },
  { key: "volumeSpike", label: "Volume Spike", type: "boolean", accessor: (s) => s.volumeSpike },
  { key: "volumeExpansion", label: "Volume Expansion", type: "boolean", accessor: (s) => s.volumeExpansion },
  { key: "deliveryTrend", label: "Delivery Trend", type: "enum", options: ["Rising", "Falling", "Flat"], accessor: (s) => s.deliveryTrend },
  { key: "accumulationScore", label: "Delivery Accumulation Score (0-100)", type: "number", accessor: (s) => s.accumulationScore },
  { key: "compositeScore", label: "Composite Score (0-100)", type: "number", accessor: (s) => s.compositeScore },
  { key: "compositeSignal", label: "Composite Signal", type: "enum", options: ["BUY", "WATCH", "AVOID"], accessor: (s) => s.compositeSignal },
];

export const FIELD_BY_KEY: Record<string, FieldDef> = Object.fromEntries(FIELD_REGISTRY.map((f) => [f.key, f]));

export function evaluateCondition(cond: StrategyCondition, snap: BacktestSnapshot): boolean {
  const field = FIELD_BY_KEY[cond.field];
  if (!field) return false;
  const actual = field.accessor(snap);
  if (actual === null) return false;

  switch (cond.operator) {
    case "equals":
      return String(actual) === String(cond.value);
    case "notEquals":
      return String(actual) !== String(cond.value);
    case "greaterThan":
      return typeof actual === "number" && actual > Number(cond.value);
    case "lessThan":
      return typeof actual === "number" && actual < Number(cond.value);
    case "isTrue":
      return actual === true;
    case "isFalse":
      return actual === false;
    default:
      return false;
  }
}

/** Weighted %% of a strategy's conditions that are true for this snapshot, 0-100. */
export function matchScore(conditions: StrategyCondition[], snap: BacktestSnapshot): number {
  if (conditions.length === 0) return 0;
  const totalWeight = conditions.reduce((sum, c) => sum + c.weight, 0) || 1;
  let matched = 0;
  for (const cond of conditions) {
    if (evaluateCondition(cond, snap)) matched += cond.weight;
  }
  return (matched / totalWeight) * 100;
}
