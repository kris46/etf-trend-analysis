import { useEffect, useRef } from "react";
import { createChart, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { EquityPoint } from "../../types/market";

function toTime(date: string): UTCTimestamp {
  return (new Date(date + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
}

const CHART_THEME = { background: "#11161f", text: "#6b7a8d", grid: "#1a212c", border: "#232b38" };
const COLORS = ["#2fd68f", "#5b8cff", "#e8b339", "#ff5c72", "#9d6bff"];

export function EquityCurveChart({ curves }: { curves: { label: string; points: EquityPoint[] }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { color: CHART_THEME.background }, textColor: CHART_THEME.text, fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
      grid: { vertLines: { color: CHART_THEME.grid }, horzLines: { color: CHART_THEME.grid } },
      rightPriceScale: { borderColor: CHART_THEME.border },
      timeScale: { borderColor: CHART_THEME.border },
    });
    chartRef.current = chart;

    curves.forEach((curve, i) => {
      const series = chart.addSeries(LineSeries, { color: COLORS[i % COLORS.length], lineWidth: 2, title: curve.label });
      series.setData(curve.points.map((p) => ({ time: toTime(p.date), value: p.equity })));
    });

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [curves]);

  return <div ref={containerRef} className="h-[320px] w-full" />;
}
