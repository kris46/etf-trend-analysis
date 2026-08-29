import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-basic-dist-min";
import type { RrgPoint, RrgSeries } from "../../types/market";

const Plot = createPlotlyComponent(Plotly);

export const SYMBOL_COLORS = ["#2fd68f", "#5b8cff", "#e8b339", "#ff5c72", "#9d6bff", "#4fd1e8", "#f08fb0", "#a3e635"];

const QUADRANT_FILLS = {
  leading: "rgba(47, 214, 143, 0.08)",
  improving: "rgba(91, 140, 255, 0.08)",
  weakening: "rgba(232, 179, 57, 0.08)",
  lagging: "rgba(255, 92, 114, 0.08)",
};

function visiblePoints(series: RrgSeries, asOfDate: string, trailLength: number): RrgPoint[] {
  const upTo = series.points.filter((p) => p.date <= asOfDate);
  return upTo.slice(-trailLength);
}

export function RrgChart({
  seriesList,
  asOfDate,
  trailLength,
  onSelectSymbol,
}: {
  seriesList: RrgSeries[];
  asOfDate: string;
  trailLength: number;
  onSelectSymbol?: (symbol: string) => void;
}) {
  const { traces, range } = useMemo(() => {
    let min = 100;
    let max = 100;

    const traces = seriesList.map((series, i) => {
      const points = visiblePoints(series, asOfDate, trailLength);
      const color = SYMBOL_COLORS[i % SYMBOL_COLORS.length];

      points.forEach((p) => {
        min = Math.min(min, p.rsRatio, p.rsMomentum);
        max = Math.max(max, p.rsRatio, p.rsMomentum);
      });

      const n = points.length;
      return {
        x: points.map((p) => p.rsRatio),
        y: points.map((p) => p.rsMomentum),
        text: points.map((p) => `${series.symbol}<br>${p.date}<br>${p.quadrant}`),
        hovertemplate: "%{text}<extra></extra>",
        mode: "lines+markers" as const,
        type: "scatter" as const,
        name: series.symbol,
        line: { color, width: 1.5 },
        marker: {
          color,
          size: points.map((_, idx) => 5 + (idx / Math.max(1, n - 1)) * 8), // grows toward the most recent point
          line: { color: "#0a0e14", width: 1 },
        },
      };
    });

    const pad = Math.max(3, (max - min) * 0.15);
    return { traces, range: [min - pad, max + pad] as [number, number] };
  }, [seriesList, asOfDate, trailLength]);

  const mid = (range[0] + range[1]) / 2;

  return (
    <Plot
      data={traces}
      onClick={(evt: any) => {
        const symbol = evt?.points?.[0]?.data?.name;
        if (symbol && onSelectSymbol) onSelectSymbol(symbol);
      }}
      layout={{
        autosize: true,
        paper_bgcolor: "#11161f",
        plot_bgcolor: "#11161f",
        font: { color: "#6b7a8d", family: "IBM Plex Mono, monospace", size: 11 },
        margin: { l: 50, r: 20, t: 20, b: 40 },
        xaxis: {
          title: { text: "RS-Ratio" },
          range,
          gridcolor: "#1a212c",
          zeroline: false,
        },
        yaxis: {
          title: { text: "RS-Momentum" },
          range,
          gridcolor: "#1a212c",
          zeroline: false,
        },
        shapes: [
          { type: "rect", x0: 100, x1: range[1], y0: 100, y1: range[1], fillcolor: QUADRANT_FILLS.leading, line: { width: 0 } },
          { type: "rect", x0: range[0], x1: 100, y0: 100, y1: range[1], fillcolor: QUADRANT_FILLS.improving, line: { width: 0 } },
          { type: "rect", x0: range[0], x1: 100, y0: range[0], y1: 100, fillcolor: QUADRANT_FILLS.lagging, line: { width: 0 } },
          { type: "rect", x0: 100, x1: range[1], y0: range[0], y1: 100, fillcolor: QUADRANT_FILLS.weakening, line: { width: 0 } },
          { type: "line", x0: 100, x1: 100, y0: range[0], y1: range[1], line: { color: "#232b38", width: 1 } },
          { type: "line", x0: range[0], x1: range[1], y0: 100, y1: 100, line: { color: "#232b38", width: 1 } },
        ],
        annotations: [
          { x: range[1] - (range[1] - mid) * 0.15, y: range[1] - (range[1] - mid) * 0.1, text: "LEADING", showarrow: false, font: { color: "#2fd68f", size: 11 } },
          { x: range[0] + (mid - range[0]) * 0.15, y: range[1] - (range[1] - mid) * 0.1, text: "IMPROVING", showarrow: false, font: { color: "#5b8cff", size: 11 } },
          { x: range[0] + (mid - range[0]) * 0.15, y: range[0] + (mid - range[0]) * 0.1, text: "LAGGING", showarrow: false, font: { color: "#ff5c72", size: 11 } },
          { x: range[1] - (range[1] - mid) * 0.15, y: range[0] + (mid - range[0]) * 0.1, text: "WEAKENING", showarrow: false, font: { color: "#e8b339", size: 11 } },
        ],
        showlegend: true,
        legend: { font: { color: "#e6edf5", size: 11 }, bgcolor: "rgba(0,0,0,0)" },
      }}
      config={{ displayModeBar: false, responsive: true }}
      useResizeHandler
      style={{ width: "100%", height: "100%" }}
    />
  );
}
