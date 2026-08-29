import { useEffect, useRef } from "react";
import { createChart, HistogramSeries, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { OhlcvBar } from "../../types/market";
import { deliveryAvg20 } from "../../lib/indicators/delivery";

function toTime(date: string): UTCTimestamp {
  return (new Date(date + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
}

const CHART_THEME = {
  background: "#11161f",
  text: "#6b7a8d",
  grid: "#1a212c",
  border: "#232b38",
};

export function DeliveryChart({ bars }: { bars: OhlcvBar[] }) {
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
      grid: { vertLines: { color: CHART_THEME.grid }, horzLines: { color: CHART_THEME.grid } },
      rightPriceScale: { borderColor: CHART_THEME.border },
      timeScale: { borderColor: CHART_THEME.border },
    });
    chartRef.current = chart;

    const barSeries = chart.addSeries(HistogramSeries, { color: "#5b8cff66", priceFormat: { type: "percent" } });
    const avgSeries = chart.addSeries(LineSeries, { color: "#e8b339", lineWidth: 1, title: "Avg20" });

    barSeries.setData(
      bars
        .filter((b) => b.DeliveryPercent !== null)
        .map((b) => ({ time: toTime(b.Date), value: b.DeliveryPercent as number }))
    );

    const avg = deliveryAvg20(bars);
    avgSeries.setData(
      bars
        .map((b, i) => ({ time: toTime(b.Date), value: avg[i] }))
        .filter((d): d is { time: UTCTimestamp; value: number } => d.value !== null)
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return <div ref={containerRef} className="h-[200px] w-full" />;
}
