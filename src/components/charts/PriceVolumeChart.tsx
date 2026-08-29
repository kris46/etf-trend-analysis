import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { OhlcvBar } from "../../types/market";
import { ema } from "../../lib/indicators/movingAverage";
import { avgVolume20 } from "../../lib/indicators/volume";

function toTime(date: string): UTCTimestamp {
  return (new Date(date + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
}

const CHART_THEME = {
  background: "#11161f",
  text: "#6b7a8d",
  grid: "#1a212c",
  border: "#232b38",
};

export function PriceVolumeChart({ bars }: { bars: OhlcvBar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: CHART_THEME.background },
        textColor: CHART_THEME.text,
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_THEME.grid },
        horzLines: { color: CHART_THEME.grid },
      },
      rightPriceScale: { borderColor: CHART_THEME.border },
      timeScale: { borderColor: CHART_THEME.border, timeVisible: false },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    // pane 0: price + EMAs
    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#2fd68f",
        downColor: "#ff5c72",
        borderVisible: false,
        wickUpColor: "#2fd68f",
        wickDownColor: "#ff5c72",
      },
      0
    );
    const ema20Series = chart.addSeries(LineSeries, { color: "#5b8cff", lineWidth: 1, title: "EMA20" }, 0);
    const ema50Series = chart.addSeries(LineSeries, { color: "#e8b339", lineWidth: 1, title: "EMA50" }, 0);
    const ema200Series = chart.addSeries(LineSeries, { color: "#9d6bff", lineWidth: 1, title: "EMA200" }, 0);

    // pane 1: volume
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      { color: "#2fd68f", priceFormat: { type: "volume" } },
      1
    );
    const avgVolSeries = chart.addSeries(LineSeries, { color: "#e6edf5", lineWidth: 1, title: "Vol Avg20" }, 1);

    chart.panes()[1]?.setHeight(110);

    const candleData = bars.map((b) => ({
      time: toTime(b.Date),
      open: b.Open,
      high: b.High,
      low: b.Low,
      close: b.Close,
    }));
    candleSeries.setData(candleData);

    const closes = bars.map((b) => b.Close);
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const ema200 = ema(closes, 200);

    ema20Series.setData(
      bars.map((b, i) => ({ time: toTime(b.Date), value: ema20[i] })).filter((d): d is { time: UTCTimestamp; value: number } => d.value !== null)
    );
    ema50Series.setData(
      bars.map((b, i) => ({ time: toTime(b.Date), value: ema50[i] })).filter((d): d is { time: UTCTimestamp; value: number } => d.value !== null)
    );
    ema200Series.setData(
      bars.map((b, i) => ({ time: toTime(b.Date), value: ema200[i] })).filter((d): d is { time: UTCTimestamp; value: number } => d.value !== null)
    );

    volumeSeries.setData(
      bars.map((b) => ({
        time: toTime(b.Date),
        value: b.Volume,
        color: b.Close >= b.Open ? "#2fd68f55" : "#ff5c7255",
      }))
    );
    const avgVol = avgVolume20(bars);
    avgVolSeries.setData(
      bars
        .map((b, i) => ({ time: toTime(b.Date), value: avgVol[i] }))
        .filter((d): d is { time: UTCTimestamp; value: number } => d.value !== null)
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return <div ref={containerRef} className="h-[420px] w-full" />;
}
