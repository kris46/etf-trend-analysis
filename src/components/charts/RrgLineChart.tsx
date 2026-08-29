import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-basic-dist-min";
import type { RrgSeries } from "../../types/market";
import { SYMBOL_COLORS } from "./RrgChart";

const Plot = createPlotlyComponent(Plotly);

export function RrgLineChart({
  seriesList,
  asOfDate,
  onSelectSymbol,
}: {
  seriesList: RrgSeries[];
  asOfDate: string;
  onSelectSymbol?: (symbol: string) => void;
}) {
  const traces = useMemo(
    () =>
      seriesList.map((series, i) => {
        const points = series.points.filter((p) => p.date <= asOfDate);
        const color = SYMBOL_COLORS[i % SYMBOL_COLORS.length];
        return {
          x: points.map((p) => p.date),
          y: points.map((p) => p.rsRatio),
          text: points.map((p) => `${series.symbol}<br>${p.date}<br>RS-Ratio ${p.rsRatio.toFixed(2)}<br>${p.quadrant}`),
          hovertemplate: "%{text}<extra></extra>",
          mode: "lines" as const,
          type: "scatter" as const,
          name: series.symbol,
          line: { color, width: 1.75 },
        };
      }),
    [seriesList, asOfDate]
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
        yaxis: { title: { text: "RS-Ratio" }, gridcolor: "#1a212c", zeroline: false },
        shapes: [
          // reference line at 100 -- above it is outperforming the benchmark, below is underperforming
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: 100, y1: 100, line: { color: "#232b38", width: 1, dash: "dash" } },
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
