/** One normalized daily bar, as produced by scripts/excel_to_json.py */
export interface OhlcvBar {
  Date: string; // ISO yyyy-mm-dd
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  DeliveryQty: number | null;
  DeliveryPercent: number | null;
  VWAP: number | null;
}

export interface ManifestEntry {
  symbol: string;
  rows: number;
  start_date: string;
  end_date: string;
  file: string;
}

export interface Manifest {
  generated_at: string;
  symbols: ManifestEntry[];
}

/** Raw bars for one symbol, oldest -> newest. */
export interface SymbolSeries {
  symbol: string;
  bars: OhlcvBar[];
}

export type TrendSignal = "Bullish" | "Neutral" | "Bearish";
export type RsSignal = "BUY" | "WATCH" | "SELL";
export type VolumeSignal = "Accumulation" | "Distribution" | "Neutral";
export type CompositeSignal = "BUY" | "WATCH" | "AVOID";
export type RrgQuadrant = "Leading" | "Improving" | "Weakening" | "Lagging";
export type RenkoSignal = "Bullish" | "Bearish" | "Neutral";

/** One point on a symbol's RRG trail. */
export interface RrgPoint {
  date: string;
  rsRatio: number;
  rsMomentum: number;
  quadrant: RrgQuadrant;
}

/** Full RRG time series for one symbol vs the active benchmark. */
export interface RrgSeries {
  symbol: string;
  benchmark: string;
  points: RrgPoint[]; // oldest -> newest
}

/** One non-repainting Renko brick. */
export interface RenkoBrick {
  index: number; // sequential brick index, not a date -- Renko has no time axis
  direction: "Bullish" | "Bearish";
  open: number;
  close: number;
  /** the bar date on which this brick was confirmed (for tooltip context only) */
  confirmedOn: string;
}

export interface RenkoResult {
  symbol: string;
  brickSize: number;
  method: "atr" | "fixed";
  bricks: RenkoBrick[]; // oldest -> newest, confirmed bricks only
}

/** Output of the indicator engine for a single symbol, computed as of the latest bar. */
export interface SymbolIndicators {
  symbol: string;
  asOf: string;
  close: number;
  changePct: number; // 1-day change

  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  trendDirection: TrendSignal;
  trendStrength: number; // 0-100

  atr14: number | null;
  atrPercent: number | null;
  volatilityRank: number | null; // 0-100 percentile within own history

  avgVolume20: number | null;
  volumeSpike: boolean;
  volumeExpansion: boolean;
  volumeTrendSignal: VolumeSignal;

  deliveryPercent: number | null;
  deliveryAvg20: number | null;
  deliveryTrend: "Rising" | "Falling" | "Flat";
  accumulationScore: number; // 0-100
  distributionScore: number; // 0-100

  rs: number | null; // ETF close / benchmark close, rebased to 100 at window start
  rsRoc: number | null; // % change in RS over the RS lookback window
  rsTrend: TrendSignal;
  rsSignal: RsSignal;
  rsRank: number | null; // 0-100 percentile of rsRoc across the active universe, filled in by ranking engine

  rrgQuadrant: RrgQuadrant | null;
  rrgRsRatio: number | null;
  rrgRsMomentum: number | null;
  rrgRotationVelocity: number | null; // magnitude of day-over-day movement in RRG space
  rrgRotationAngle: number | null; // degrees, 0-360, direction of travel in RRG space
  rrgTransition: string | null; // e.g. "Improving -> Leading", null if quadrant unchanged

  renkoSignal: RenkoSignal;
  renkoTrendAge: number; // consecutive bricks in the current direction
  renkoTrendStrength: number; // 0-100
  renkoReversalSignal: boolean; // true if the latest brick flipped direction
  renkoBullishBrickCount: number; // within the trailing window used for the count
  renkoBearishBrickCount: number;
}

export interface RankingWeights {
  relativeStrength: number;
  trend: number;
  volume: number;
  delivery: number;
  rrg: number;
  renko: number;
}

export interface RankingBreakdownItem {
  label: string;
  rawScore: number; // 0-100
  weight: number; // 0-100
  contribution: number; // rawScore * weight / 100
  reasons: string[];
}

export interface SymbolRanking {
  symbol: string;
  compositeScore: number; // 0-100
  compositeSignal: CompositeSignal;
  breakdown: RankingBreakdownItem[];
}

/** A single explainability bullet, with a polarity so the UI can render a check or cross. */
export interface ExplainReason {
  text: string;
  supportsSignal: boolean; // true = "✓" (agrees with the overall signal), false = "✗" (contradicts it)
}

/** Formal output of the Explainability Engine for one symbol -- never shown without this attached. */
export interface ExplainabilityResult {
  symbol: string;
  signal: CompositeSignal;
  confidence: number; // 0-100
  reasons: ExplainReason[];
}

// ---------------------------------------------------------------------------
// Phase 3: Strategy Builder & Backtesting
// ---------------------------------------------------------------------------

export type StrategyFieldType = "number" | "boolean" | "enum";
export type StrategyOperator = "equals" | "notEquals" | "greaterThan" | "lessThan" | "isTrue" | "isFalse";

/** What a strategy condition can be evaluated against -- a day's indicators plus that day's ranking. */
export interface BacktestSnapshot extends SymbolIndicators {
  compositeScore: number;
  compositeSignal: CompositeSignal;
}

export interface StrategyCondition {
  id: string;
  field: string; // key into the field registry, see src/lib/backtest/fields.ts
  operator: StrategyOperator;
  value: string | number | boolean;
  weight: number; // 0-100, relative weight among this strategy's conditions
}

export interface Strategy {
  id: string;
  name: string;
  conditions: StrategyCondition[];
  entryThreshold: number; // 0-100: the weighted %% of conditions that must be true to enter
  holdingPeriodDays: number;
}

export interface BacktestConfig {
  universe: string[];
  benchmark: string;
  startDate: string;
  endDate: string;
  startingCapital: number;
  positionSizePct: number; // % of starting capital allocated per trade (fixed, not compounding -- see runBacktest.ts)
  costBps: number;
  slippageBps: number;
}

export interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number; // executed price, after cost + slippage
  exitDate: string;
  exitPrice: number;
  holdingDays: number;
  returnPct: number;
  pnl: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface BacktestStats {
  totalTrades: number;
  winRate: number; // 0-100
  profitFactor: number | null; // null = no losing trades (undefined/infinite)
  averageReturnPct: number;
  avgHoldingDays: number;
  maxDrawdownPct: number;
  finalEquity: number;
  totalReturnPct: number;
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  trades: Trade[];
  equityCurve: EquityPoint[];
  stats: BacktestStats;
}

