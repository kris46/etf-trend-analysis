import type { OhlcvBar, RrgPoint, RrgQuadrant, RrgSeries } from "../../types/market";
import { ema } from "./movingAverage";
import { rollingZScoreCentered } from "./stats";

/**
 * This reproduces the publicly documented mechanics of a Relative Rotation
 * Graph (relative price -> smoothed -> rolling z-score "RS-Ratio" -> a
 * second rolling z-score of that for "RS-Momentum"). It is NOT the exact
 * proprietary JdK RRG formula (that calculation has never been published) —
 * it's a transparent, from-scratch approximation that produces the same
 * quadrant behaviour and is good enough for swing-trading research.
 */
export interface RrgOptions {
  smoothPeriod: number; // light EMA smoothing on the raw relative-price line
  ratioWindow: number; // rolling window for the RS-Ratio z-score
  momentumWindow: number; // rolling window for the RS-Momentum z-score
  ratioScale: number; // spreads RS-Ratio around 100 (typical charts run ~94-106)
  momentumScale: number;
}

export const DEFAULT_RRG_OPTIONS: RrgOptions = {
  smoothPeriod: 3,
  ratioWindow: 63, // ~ a trading quarter
  momentumWindow: 21, // ~ a trading month
  ratioScale: 1.5,
  momentumScale: 1.5,
};

function alignByDate(symbol: OhlcvBar[], benchmark: OhlcvBar[]) {
  const benchByDate = new Map(benchmark.map((bar) => [bar.Date, bar]));
  const dates: string[] = [];
  const symbolClose: number[] = [];
  const benchClose: number[] = [];
  for (const bar of symbol) {
    const match = benchByDate.get(bar.Date);
    if (match) {
      dates.push(bar.Date);
      symbolClose.push(bar.Close);
      benchClose.push(match.Close);
    }
  }
  return { dates, symbolClose, benchClose };
}

function quadrantOf(rsRatio: number, rsMomentum: number): RrgQuadrant {
  if (rsRatio >= 100 && rsMomentum >= 100) return "Leading";
  if (rsRatio < 100 && rsMomentum >= 100) return "Improving";
  if (rsRatio < 100 && rsMomentum < 100) return "Lagging";
  return "Weakening";
}

/** First index where every value from there onward is non-null. */
function firstValidIndex(values: (number | null)[]): number {
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) return i;
  }
  return values.length;
}

export function computeRrgSeries(
  symbol: string,
  symbolBars: OhlcvBar[],
  benchmark: string,
  benchmarkBars: OhlcvBar[],
  opts: RrgOptions = DEFAULT_RRG_OPTIONS
): RrgSeries {
  const { dates, symbolClose, benchClose } = alignByDate(symbolBars, benchmarkBars);
  if (dates.length < opts.ratioWindow + opts.momentumWindow) {
    return { symbol, benchmark, points: [] };
  }

  const relative = symbolClose.map((c, i) => c / benchClose[i]);
  const relativeSmoothed = ema(relative, opts.smoothPeriod);

  const startA = firstValidIndex(relativeSmoothed);
  const cleanRelative = relativeSmoothed.slice(startA) as number[];
  const datesA = dates.slice(startA);

  const rsRatioRaw = rollingZScoreCentered(cleanRelative, opts.ratioWindow, 100, opts.ratioScale);
  const startB = firstValidIndex(rsRatioRaw);
  const cleanRsRatio = rsRatioRaw.slice(startB) as number[];
  const datesB = datesA.slice(startB);

  const rsMomentumRaw = rollingZScoreCentered(cleanRsRatio, opts.momentumWindow, 100, opts.momentumScale);
  const startC = firstValidIndex(rsMomentumRaw);
  const cleanRsMomentum = rsMomentumRaw.slice(startC) as number[];
  const datesC = datesB.slice(startC);
  const finalRsRatio = cleanRsRatio.slice(startC);

  const points: RrgPoint[] = datesC.map((date, i) => ({
    date,
    rsRatio: finalRsRatio[i],
    rsMomentum: cleanRsMomentum[i],
    quadrant: quadrantOf(finalRsRatio[i], cleanRsMomentum[i]),
  }));

  return { symbol, benchmark, points };
}

export interface RrgLatestMetrics {
  quadrant: RrgQuadrant | null;
  rsRatio: number | null;
  rsMomentum: number | null;
  rotationVelocity: number | null;
  rotationAngle: number | null;
  transition: string | null;
}

/** Derives the "as of today" metrics (quadrant, rotation, transition) from a full RRG series. */
export function computeRrgLatestMetrics(series: RrgSeries, transitionLookback = 5): RrgLatestMetrics {
  const { points } = series;
  if (points.length === 0) {
    return { quadrant: null, rsRatio: null, rsMomentum: null, rotationVelocity: null, rotationAngle: null, transition: null };
  }

  const last = points[points.length - 1];
  const prev = points.length >= 2 ? points[points.length - 2] : null;

  let rotationVelocity: number | null = null;
  let rotationAngle: number | null = null;
  if (prev) {
    const dx = last.rsRatio - prev.rsRatio;
    const dy = last.rsMomentum - prev.rsMomentum;
    rotationVelocity = Math.sqrt(dx * dx + dy * dy);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    rotationAngle = angle;
  }

  const priorIdx = points.length - 1 - transitionLookback;
  let transition: string | null = null;
  if (priorIdx >= 0) {
    const priorQuadrant = points[priorIdx].quadrant;
    if (priorQuadrant !== last.quadrant) {
      transition = `${priorQuadrant} -> ${last.quadrant}`;
    }
  }

  return {
    quadrant: last.quadrant,
    rsRatio: last.rsRatio,
    rsMomentum: last.rsMomentum,
    rotationVelocity,
    rotationAngle,
    transition,
  };
}

export interface RrgPerPointMetrics {
  rotationVelocity: (number | null)[];
  rotationAngle: (number | null)[];
  transition: (string | null)[];
}

/**
 * Vectorized version of computeRrgLatestMetrics: one value per RRG point
 * (single pass), so the backtest engine can ask "what would RRG have shown
 * as of point k" for every k without re-deriving from scratch each time.
 */
export function computeRrgPerPointMetrics(series: RrgSeries, transitionLookback = 5): RrgPerPointMetrics {
  const { points } = series;
  const n = points.length;
  const rotationVelocity = new Array<number | null>(n).fill(null);
  const rotationAngle = new Array<number | null>(n).fill(null);
  const transition = new Array<string | null>(n).fill(null);

  for (let k = 0; k < n; k++) {
    if (k > 0) {
      const dx = points[k].rsRatio - points[k - 1].rsRatio;
      const dy = points[k].rsMomentum - points[k - 1].rsMomentum;
      rotationVelocity[k] = Math.sqrt(dx * dx + dy * dy);
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      rotationAngle[k] = angle;
    }
    const priorIdx = k - transitionLookback;
    if (priorIdx >= 0 && points[priorIdx].quadrant !== points[k].quadrant) {
      transition[k] = `${points[priorIdx].quadrant} -> ${points[k].quadrant}`;
    }
  }

  return { rotationVelocity, rotationAngle, transition };
}

/**
 * For each bar index, the index into `series.points` for that same date, or
 * -1 if RRG isn't available yet for that date (still in warmup). O(bars).
 */
export function mapBarsToRrgPointIndex(bars: OhlcvBar[], series: RrgSeries): number[] {
  const dateToPoint = new Map(series.points.map((p, idx) => [p.date, idx]));
  return bars.map((b) => dateToPoint.get(b.Date) ?? -1);
}
