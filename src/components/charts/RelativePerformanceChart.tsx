import { useEffect, useRef } from "react";
import { createChart, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { OhlcvBar } from "../../types/market";

function toTime(date: string): UTCTimestamp {
  return (new Date(date + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
}

const CHART_THEME = {
  background: "#11161f",
  text: "#6b7a8d",
  grid: "#1a212c",
  border: "#232b38",
};

export function RelativePerformanceChart({
  symbolBars,
  benchmarkBars,
  symbolLabel,
  benchmarkLabel,
}: {
  symbolBars: OhlcvBar[];
  benchmarkBars: OhlcvBar[];
  symbolLabel: string;
  benchmarkLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const benchByDate = new Map(benchmarkBars.map((b) => [b.Date, b]));
    const aligned: { date: string; symbolClose: number; benchClose: number }[] = [];
    for (const bar of symbolBars) {
      const match = benchByDate.get(bar.Date);
      if (match) aligned.push({ date: bar.Date, symbolClose: bar.Close, benchClose: match.Close });
    }

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

    const symbolSeries = chart.addSeries(LineSeries, { color: "#2fd68f", lineWidth: 2, title: symbolLabel });
    const benchSeries = chart.addSeries(LineSeries, { color: "#6b7a8d", lineWidth: 2, title: benchmarkLabel });

    if (aligned.length > 0) {
      const baseSymbol = aligned[0].symbolClose;
      const baseBench = aligned[0].benchClose;
      symbolSeries.setData(aligned.map((a) => ({ time: toTime(a.date), value: (a.symbolClose / baseSymbol) * 100 })));
      benchSeries.setData(aligned.map((a) => ({ time: toTime(a.date), value: (a.benchClose / baseBench) * 100 })));
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [symbolBars, benchmarkBars, symbolLabel, benchmarkLabel]);

  return <div ref={containerRef} className="h-[260px] w-full" />;
}
