import type { OhlcvBar, RenkoBrick, RenkoResult } from "../../types/market";
import { atr } from "./volatility";

export interface RenkoOptions {
  method: "atr" | "fixed";
  atrPeriod: number;
  atrMultiple: number;
  fixedBrickSize: number | null; // required when method === "fixed"
}

export const DEFAULT_RENKO_OPTIONS: RenkoOptions = {
  method: "atr",
  atrPeriod: 14,
  atrMultiple: 1,
  fixedBrickSize: null,
};

/**
 * Non-repainting does NOT have to mean "brick size frozen forever from the
 * first available reading" -- for a symbol with 20+ years of history (e.g.
 * BANKBEES, ~10x higher today than in 2004), that would size every brick
 * off 2004-era volatility, producing absurdly fine bricks against today's
 * price. The correct causal approach: at each bar, size the *next* brick
 * using the ATR known *as of that bar* (never future data). Once a brick is
 * confirmed it is never revisited, so appending new days only ever adds
 * bricks -- it never rewrites history. Brick size simply adapts forward as
 * volatility does, the way a live trading terminal would behave.
 */
export function computeRenko(symbol: string, bars: OhlcvBar[], opts: RenkoOptions = DEFAULT_RENKO_OPTIONS): RenkoResult {
  if (bars.length < 2) {
    return { symbol, brickSize: 0, method: opts.method, bricks: [] };
  }

  const fixedSize = opts.method === "fixed" ? opts.fixedBrickSize && opts.fixedBrickSize > 0 ? opts.fixedBrickSize : bars[0].Close * 0.01 : null;
  const atrSeries = opts.method === "atr" ? atr(bars, opts.atrPeriod) : null;

  let lastKnownAtrBrick = bars[0].Close * 0.01; // fallback until ATR warms up
  const brickSizeAt = (i: number): number => {
    if (fixedSize !== null) return fixedSize;
    const a = atrSeries![i];
    if (a !== null) lastKnownAtrBrick = a * opts.atrMultiple;
    return lastKnownAtrBrick > 0 ? lastKnownAtrBrick : bars[0].Close * 0.01;
  };

  const bricks: RenkoBrick[] = [];
  let anchor = bars[0].Close;
  let direction: "Bullish" | "Bearish" | null = null;

  const pushBullish = (steps: number, date: string, size: number) => {
    for (let s = 0; s < steps; s++) {
      bricks.push({ index: bricks.length, direction: "Bullish", open: anchor + s * size, close: anchor + (s + 1) * size, confirmedOn: date });
    }
    anchor += steps * size;
  };
  const pushBearish = (steps: number, date: string, size: number) => {
    for (let s = 0; s < steps; s++) {
      bricks.push({ index: bricks.length, direction: "Bearish", open: anchor - s * size, close: anchor - (s + 1) * size, confirmedOn: date });
    }
    anchor -= steps * size;
  };

  for (let i = 1; i < bars.length; i++) {
    const close = bars[i].Close;
    const date = bars[i].Date;
    const brickSize = brickSizeAt(i); // causal: only uses data up to and including bar i

    if (direction === null) {
      if (close - anchor >= brickSize) {
        pushBullish(Math.floor((close - anchor) / brickSize), date, brickSize);
        direction = "Bullish";
      } else if (anchor - close >= brickSize) {
        pushBearish(Math.floor((anchor - close) / brickSize), date, brickSize);
        direction = "Bearish";
      }
      continue;
    }

    if (direction === "Bullish") {
      if (close - anchor >= brickSize) {
        pushBullish(Math.floor((close - anchor) / brickSize), date, brickSize);
      } else if (anchor - close >= 2 * brickSize) {
        // classic 2-brick reversal rule
        pushBearish(Math.floor((anchor - close) / brickSize), date, brickSize);
        direction = "Bearish";
      }
    } else {
      if (anchor - close >= brickSize) {
        pushBearish(Math.floor((anchor - close) / brickSize), date, brickSize);
      } else if (close - anchor >= 2 * brickSize) {
        pushBullish(Math.floor((close - anchor) / brickSize), date, brickSize);
        direction = "Bullish";
      }
    }
  }

  // report the brick size currently in effect (i.e. what would size the *next* brick) --
  // the practically relevant number for a trader reading today's chart.
  const currentBrickSize = brickSizeAt(bars.length - 1);

  return { symbol, brickSize: currentBrickSize, method: opts.method, bricks };
}

export interface RenkoLatestMetrics {
  signal: "Bullish" | "Bearish" | "Neutral";
  trendAge: number;
  trendStrength: number;
  reversalSignal: boolean;
  bullishBrickCount: number;
  bearishBrickCount: number;
}

export function computeRenkoLatestMetrics(result: RenkoResult, countWindow = 50): RenkoLatestMetrics {
  const { bricks } = result;
  if (bricks.length === 0) {
    return { signal: "Neutral", trendAge: 0, trendStrength: 0, reversalSignal: false, bullishBrickCount: 0, bearishBrickCount: 0 };
  }

  const last = bricks[bricks.length - 1];
  let trendAge = 0;
  for (let i = bricks.length - 1; i >= 0; i--) {
    if (bricks[i].direction === last.direction) trendAge++;
    else break;
  }

  const reversalSignal = bricks.length >= 2 && bricks[bricks.length - 2].direction !== last.direction;
  const trendStrength = Math.min(100, trendAge * 10);

  const window = bricks.slice(-countWindow);
  const bullishBrickCount = window.filter((b) => b.direction === "Bullish").length;
  const bearishBrickCount = window.filter((b) => b.direction === "Bearish").length;

  return { signal: last.direction, trendAge, trendStrength, reversalSignal, bullishBrickCount, bearishBrickCount };
}

export interface RenkoPerBrickMetrics {
  trendAge: number[];
  trendStrength: number[];
  reversalSignal: boolean[];
  bullishBrickCount: number[];
  bearishBrickCount: number[];
}

/**
 * Vectorized version of computeRenkoLatestMetrics: one value per brick
 * (single forward pass, O(numBricks)) so the backtest engine can ask "what
 * would Renko have signaled as of brick k" for every k without re-scanning
 * the whole brick list each time.
 */
export function computeRenkoPerBrickMetrics(result: RenkoResult, countWindow = 50): RenkoPerBrickMetrics {
  const { bricks } = result;
  const n = bricks.length;
  const trendAge = new Array<number>(n);
  const trendStrength = new Array<number>(n);
  const reversalSignal = new Array<boolean>(n);
  const bullishBrickCount = new Array<number>(n);
  const bearishBrickCount = new Array<number>(n);

  let bullCount = 0;
  let bearCount = 0;

  for (let k = 0; k < n; k++) {
    trendAge[k] = k === 0 ? 1 : bricks[k].direction === bricks[k - 1].direction ? trendAge[k - 1] + 1 : 1;
    reversalSignal[k] = k > 0 && bricks[k].direction !== bricks[k - 1].direction;
    trendStrength[k] = Math.min(100, trendAge[k] * 10);

    if (bricks[k].direction === "Bullish") bullCount++;
    else bearCount++;
    if (k - countWindow >= 0) {
      if (bricks[k - countWindow].direction === "Bullish") bullCount--;
      else bearCount--;
    }
    bullishBrickCount[k] = bullCount;
    bearishBrickCount[k] = bearCount;
  }

  return { trendAge, trendStrength, reversalSignal, bullishBrickCount, bearishBrickCount };
}

/**
 * For each bar index, the index of the latest CONFIRMED brick on or before
 * that bar's date, or -1 if no brick has formed yet. Two-pointer forward
 * sweep, O(bars + bricks) -- this is what lets the backtest engine ask
 * "what did Renko look like as of bar i" in O(1) per bar.
 */
export function mapBarsToBrickIndex(bars: OhlcvBar[], bricks: RenkoBrick[]): number[] {
  const out = new Array<number>(bars.length).fill(-1);
  let brickPtr = 0;
  let lastConfirmed = -1;
  for (let i = 0; i < bars.length; i++) {
    while (brickPtr < bricks.length && bricks[brickPtr].confirmedOn <= bars[i].Date) {
      lastConfirmed = brickPtr;
      brickPtr++;
    }
    out[i] = lastConfirmed;
  }
  return out;
}
