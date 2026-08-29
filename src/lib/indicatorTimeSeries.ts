import type {
  OhlcvBar,
  RenkoSignal,
  RrgQuadrant,
  RsSignal,
  SymbolIndicators,
  SymbolSeries,
  TrendSignal,
  VolumeSignal,
} from "../types/market";
import { ema } from "./indicators/movingAverage";
import { atr, atrPercent, volatilityRankSeries } from "./indicators/volatility";
import { avgVolume20, isVolumeSpike, isVolumeExpansion, volumeTrendSignal } from "./indicators/volume";
import { deliveryAvg20, deliveryTrend, accumulationDistributionScores } from "./indicators/delivery";
import { trendDirection, trendStrength } from "./indicators/trend";
import { computeRelativeStrength } from "./indicators/relativeStrength";
import { computeRrgSeries, computeRrgPerPointMetrics, mapBarsToRrgPointIndex } from "./indicators/rrg";
import { computeRenko, computeRenkoPerBrickMetrics, mapBarsToBrickIndex } from "./indicators/renko";

/**
 * Every field here is an array aligned 1:1 with `bars` (index i describes
 * the state of the world as of bars[i], using only bars[0..i] -- nothing
 * later). This is the single source of truth for indicator state: the live
 * dashboard reads index `bars.length - 1`, the backtest engine walks every
 * index. Computing it once this way (rather than two separate
 * implementations) is what guarantees a backtest result actually reflects
 * what the dashboard would have shown on that historical day.
 */
export interface SymbolTimeSeries {
  symbol: string;
  benchmark: string | null;
  dates: string[];
  bars: OhlcvBar[];

  ema20: (number | null)[];
  ema50: (number | null)[];
  ema200: (number | null)[];
  trendDirection: TrendSignal[];
  trendStrength: number[];

  atr14: (number | null)[];
  atrPercent: (number | null)[];
  volatilityRank: (number | null)[];

  avgVolume20: (number | null)[];
  volumeSpike: boolean[];
  volumeExpansion: boolean[];
  volumeTrendSignal: VolumeSignal[];

  deliveryAvg20: (number | null)[];
  deliveryTrend: ("Rising" | "Falling" | "Flat")[];
  accumulationScore: number[];
  distributionScore: number[];

  rs: (number | null)[];
  rsRoc: (number | null)[];
  rsTrend: TrendSignal[];
  rsSignal: RsSignal[];

  rrgQuadrant: (RrgQuadrant | null)[];
  rrgRsRatio: (number | null)[];
  rrgRsMomentum: (number | null)[];
  rrgRotationVelocity: (number | null)[];
  rrgRotationAngle: (number | null)[];
  rrgTransition: (string | null)[];

  renkoSignal: RenkoSignal[];
  renkoTrendAge: number[];
  renkoTrendStrength: number[];
  renkoReversalSignal: boolean[];
  renkoBullishBrickCount: number[];
  renkoBearishBrickCount: number[];
}

export function computeSymbolTimeSeries(series: SymbolSeries, benchmark: SymbolSeries | null): SymbolTimeSeries {
  const { symbol, bars } = series;
  const n = bars.length;
  const closes = bars.map((b) => b.Close);
  const dates = bars.map((b) => b.Date);

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);

  const trendDirectionArr: TrendSignal[] = new Array(n);
  const trendStrengthArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    trendDirectionArr[i] = trendDirection(closes[i], ema20[i], ema50[i], ema200[i]);
    trendStrengthArr[i] = trendStrength(closes[i], ema200[i], ema50[i]);
  }

  const atr14 = atr(bars, 14);
  const atrPct = atrPercent(bars, 14);
  const volRank = volatilityRankSeries(atrPct);

  const avgVol20 = avgVolume20(bars);
  const volSpike: boolean[] = new Array(n);
  const volExpansion: boolean[] = new Array(n);
  const volSignal: VolumeSignal[] = new Array(n);
  for (let i = 0; i < n; i++) {
    volSpike[i] = isVolumeSpike(bars, 1.5, i, avgVol20);
    volExpansion[i] = isVolumeExpansion(bars, i, avgVol20);
    volSignal[i] = volumeTrendSignal(bars, 10, i, avgVol20);
  }

  const delivAvg20 = deliveryAvg20(bars);
  const delivTrendArr: ("Rising" | "Falling" | "Flat")[] = new Array(n);
  const accumArr: number[] = new Array(n);
  const distribArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    delivTrendArr[i] = deliveryTrend(bars, 10, i, delivAvg20);
    const { accumulationScore, distributionScore } = accumulationDistributionScores(bars, 10, i);
    accumArr[i] = accumulationScore;
    distribArr[i] = distributionScore;
  }

  const isOwnBenchmark = !benchmark || benchmark.symbol === symbol;

  const rsArr: (number | null)[] = new Array(n).fill(null);
  const rsRocArr: (number | null)[] = new Array(n).fill(null);
  const rsTrendArr: TrendSignal[] = new Array(n).fill("Neutral");
  const rsSignalArr: RsSignal[] = new Array(n).fill("WATCH");

  const rrgQuadrantArr: (RrgQuadrant | null)[] = new Array(n).fill(null);
  const rrgRsRatioArr: (number | null)[] = new Array(n).fill(null);
  const rrgRsMomentumArr: (number | null)[] = new Array(n).fill(null);
  const rrgVelocityArr: (number | null)[] = new Array(n).fill(null);
  const rrgAngleArr: (number | null)[] = new Array(n).fill(null);
  const rrgTransitionArr: (string | null)[] = new Array(n).fill(null);

  if (!isOwnBenchmark && benchmark) {
    const rs = computeRelativeStrength(bars, benchmark.bars);
    const dateToRsIdx = new Map(rs.dates.map((d, i) => [d, i]));
    for (let i = 0; i < n; i++) {
      const j = dateToRsIdx.get(dates[i]);
      if (j !== undefined) {
        rsArr[i] = rs.series[j];
        rsRocArr[i] = rs.rsRocSeries[j];
        rsTrendArr[i] = rs.rsTrendSeries[j];
        rsSignalArr[i] = rs.rsSignalSeries[j];
      }
    }

    const rrgSeries = computeRrgSeries(symbol, bars, benchmark.symbol, benchmark.bars);
    const rrgPerPoint = computeRrgPerPointMetrics(rrgSeries);
    const barToPoint = mapBarsToRrgPointIndex(bars, rrgSeries);
    for (let i = 0; i < n; i++) {
      const p = barToPoint[i];
      if (p >= 0) {
        rrgQuadrantArr[i] = rrgSeries.points[p].quadrant;
        rrgRsRatioArr[i] = rrgSeries.points[p].rsRatio;
        rrgRsMomentumArr[i] = rrgSeries.points[p].rsMomentum;
        rrgVelocityArr[i] = rrgPerPoint.rotationVelocity[p];
        rrgAngleArr[i] = rrgPerPoint.rotationAngle[p];
        rrgTransitionArr[i] = rrgPerPoint.transition[p];
      }
    }
  }

  const renko = computeRenko(symbol, bars);
  const renkoPerBrick = computeRenkoPerBrickMetrics(renko);
  const barToBrick = mapBarsToBrickIndex(bars, renko.bricks);
  const renkoSignalArr: RenkoSignal[] = new Array(n);
  const renkoTrendAgeArr: number[] = new Array(n);
  const renkoTrendStrengthArr: number[] = new Array(n);
  const renkoReversalArr: boolean[] = new Array(n);
  const renkoBullArr: number[] = new Array(n);
  const renkoBearArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = barToBrick[i];
    if (b >= 0) {
      renkoSignalArr[i] = renko.bricks[b].direction;
      renkoTrendAgeArr[i] = renkoPerBrick.trendAge[b];
      renkoTrendStrengthArr[i] = renkoPerBrick.trendStrength[b];
      renkoReversalArr[i] = renkoPerBrick.reversalSignal[b];
      renkoBullArr[i] = renkoPerBrick.bullishBrickCount[b];
      renkoBearArr[i] = renkoPerBrick.bearishBrickCount[b];
    } else {
      renkoSignalArr[i] = "Neutral";
      renkoTrendAgeArr[i] = 0;
      renkoTrendStrengthArr[i] = 0;
      renkoReversalArr[i] = false;
      renkoBullArr[i] = 0;
      renkoBearArr[i] = 0;
    }
  }

  return {
    symbol,
    benchmark: benchmark?.symbol ?? null,
    dates,
    bars,
    ema20,
    ema50,
    ema200,
    trendDirection: trendDirectionArr,
    trendStrength: trendStrengthArr,
    atr14,
    atrPercent: atrPct,
    volatilityRank: volRank,
    avgVolume20: avgVol20,
    volumeSpike: volSpike,
    volumeExpansion: volExpansion,
    volumeTrendSignal: volSignal,
    deliveryAvg20: delivAvg20,
    deliveryTrend: delivTrendArr,
    accumulationScore: accumArr,
    distributionScore: distribArr,
    rs: rsArr,
    rsRoc: rsRocArr,
    rsTrend: rsTrendArr,
    rsSignal: rsSignalArr,
    rrgQuadrant: rrgQuadrantArr,
    rrgRsRatio: rrgRsRatioArr,
    rrgRsMomentum: rrgRsMomentumArr,
    rrgRotationVelocity: rrgVelocityArr,
    rrgRotationAngle: rrgAngleArr,
    rrgTransition: rrgTransitionArr,
    renkoSignal: renkoSignalArr,
    renkoTrendAge: renkoTrendAgeArr,
    renkoTrendStrength: renkoTrendStrengthArr,
    renkoReversalSignal: renkoReversalArr,
    renkoBullishBrickCount: renkoBullArr,
    renkoBearishBrickCount: renkoBearArr,
  };
}

/**
 * Extracts a single-day SymbolIndicators-shaped snapshot from a precomputed
 * time series. `rsRank` is always left null here -- it's cross-sectional
 * (depends on the whole universe on that day) and gets filled in by the
 * ranking engine, exactly as in the live dashboard path.
 */
export function snapshotAt(ts: SymbolTimeSeries, index: number): SymbolIndicators {
  const bar = ts.bars[index];
  const prevClose = index > 0 ? ts.bars[index - 1].Close : bar.Close;

  return {
    symbol: ts.symbol,
    asOf: bar.Date,
    close: bar.Close,
    changePct: prevClose === 0 ? 0 : ((bar.Close - prevClose) / prevClose) * 100,

    ema20: ts.ema20[index],
    ema50: ts.ema50[index],
    ema200: ts.ema200[index],
    trendDirection: ts.trendDirection[index],
    trendStrength: ts.trendStrength[index],

    atr14: ts.atr14[index],
    atrPercent: ts.atrPercent[index],
    volatilityRank: ts.volatilityRank[index],

    avgVolume20: ts.avgVolume20[index],
    volumeSpike: ts.volumeSpike[index],
    volumeExpansion: ts.volumeExpansion[index],
    volumeTrendSignal: ts.volumeTrendSignal[index],

    deliveryPercent: bar.DeliveryPercent,
    deliveryAvg20: ts.deliveryAvg20[index],
    deliveryTrend: ts.deliveryTrend[index],
    accumulationScore: ts.accumulationScore[index],
    distributionScore: ts.distributionScore[index],

    rs: ts.rs[index],
    rsRoc: ts.rsRoc[index],
    rsTrend: ts.rsTrend[index],
    rsSignal: ts.rsSignal[index],
    rsRank: null,

    rrgQuadrant: ts.rrgQuadrant[index],
    rrgRsRatio: ts.rrgRsRatio[index],
    rrgRsMomentum: ts.rrgRsMomentum[index],
    rrgRotationVelocity: ts.rrgRotationVelocity[index],
    rrgRotationAngle: ts.rrgRotationAngle[index],
    rrgTransition: ts.rrgTransition[index],

    renkoSignal: ts.renkoSignal[index],
    renkoTrendAge: ts.renkoTrendAge[index],
    renkoTrendStrength: ts.renkoTrendStrength[index],
    renkoReversalSignal: ts.renkoReversalSignal[index],
    renkoBullishBrickCount: ts.renkoBullishBrickCount[index],
    renkoBearishBrickCount: ts.renkoBearishBrickCount[index],
  };
}
