import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-basic-dist-min";
import type { PerformanceSeries } from "../../lib/performanceComparison";
import { SYMBOL_COLORS } from "./RrgChart";

const Plot = createPlotlyComponent(Plotly);

export function PerformanceComparisonChart({
  seriesList,
  onSelectSymbol,
}: {
  seriesList: PerformanceSeries[];
  onSelectSymbol?: (symbol: string) => void;
}) {
  const traces = useMemo(
    () =>
      seriesList.map((series, i) => {
        const color = SYMBOL_COLORS[i % SYMBOL_COLORS.length];
        return {
          x: series.points.map((p) => p.date),
          y: series.points.map((p) => p.pctReturn),
          text: series.points.map((p) => `${series.symbol}<br>${p.date}<br>${p.pctReturn >= 0 ? "+" : ""}${p.pctReturn.toFixed(2)}%`),
          hovertemplate: "%{text}<extra></extra>",
          mode: "lines" as const,
          type: "scatter" as const,
          name: series.symbol,
          line: { color, width: 1.75 },
        };
      }),
    [seriesList]
  );

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
        xaxis: { gridcolor: "#1a212c", zeroline: false },
        yaxis: { title: { text: "Return since start of window (%)" }, gridcolor: "#1a212c", zeroline: false },
        shapes: [
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: "#232b38", width: 1, dash: "dash" } },
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
