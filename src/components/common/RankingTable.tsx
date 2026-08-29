import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import type { SymbolIndicators, SymbolRanking } from "../../types/market";
import { SignalBadge } from "../common/SignalBadge";
import { NumCell } from "../common/NumCell";

export interface RankRow {
  rank: number;
  ranking: SymbolRanking;
  indicators: SymbolIndicators;
}

const columnHelper = createColumnHelper<RankRow>();

export function RankingTable({ rows }: { rows: RankRow[] }) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((r) => r.rank, {
        id: "rank",
        header: "#",
        cell: (ctx) => <span className="num text-ink-muted">{ctx.getValue()}</span>,
      }),
      columnHelper.accessor((r) => r.ranking.symbol, {
        id: "symbol",
        header: "Symbol",
        cell: (ctx) => <span className="font-medium text-ink">{ctx.getValue()}</span>,
      }),
      columnHelper.accessor((r) => r.indicators.close, {
        id: "close",
        header: "Close",
        cell: (ctx) => <NumCell value={ctx.getValue()} />,
      }),
      columnHelper.accessor((r) => r.indicators.changePct, {
        id: "changePct",
        header: "Chg %",
        cell: (ctx) => <NumCell value={ctx.getValue()} suffix="%" colorBySign />,
      }),
      columnHelper.accessor((r) => r.ranking.compositeScore, {
        id: "score",
        header: "Score",
        cell: (ctx) => <NumCell value={ctx.getValue()} decimals={0} />,
      }),
      columnHelper.accessor((r) => r.ranking.compositeSignal, {
        id: "signal",
        header: "Signal",
        cell: (ctx) => <SignalBadge label={ctx.getValue()} />,
      }),
      columnHelper.accessor((r) => r.indicators.rrgQuadrant, {
        id: "rrg",
        header: "RRG",
        cell: (ctx) => {
          const v = ctx.getValue();
          return v ? <SignalBadge label={v} /> : <span className="text-ink-faint">—</span>;
        },
      }),
      columnHelper.accessor((r) => r.indicators.rsRank, {
        id: "rsRank",
        header: "RS Rank",
        cell: (ctx) => <NumCell value={ctx.getValue()} decimals={0} />,
      }),
      columnHelper.accessor((r) => r.indicators.renkoSignal, {
        id: "renko",
        header: "Renko",
        cell: (ctx) => <SignalBadge label={ctx.getValue()} />,
      }),
      columnHelper.accessor((r) => r.indicators.trendDirection, {
        id: "trend",
        header: "Trend",
        cell: (ctx) => <SignalBadge label={ctx.getValue()} />,
      }),
      columnHelper.accessor((r) => r.indicators.volumeTrendSignal, {
        id: "volume",
        header: "Volume",
        cell: (ctx) => <SignalBadge label={ctx.getValue()} />,
      }),
      columnHelper.accessor((r) => r.indicators.accumulationScore, {
        id: "delivery",
        header: "Delivery",
        cell: (ctx) => <NumCell value={ctx.getValue()} decimals={0} />,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-sm border border-line">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-line bg-surface-raised">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted hover:text-ink"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => navigate(`/etf/${row.original.ranking.symbol}`)}
              className="cursor-pointer border-b border-line bg-surface transition-colors last:border-b-0 hover:bg-surface-raised"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
