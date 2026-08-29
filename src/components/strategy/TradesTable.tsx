import type { Trade } from "../../types/market";
import { NumCell } from "../common/NumCell";

export function TradesTable({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return <div className="rounded-sm border border-line bg-surface p-4 text-sm text-ink-muted">No trades triggered for this strategy over the selected period.</div>;
  }

  return (
    <div className="max-h-[420px] overflow-y-auto rounded-sm border border-line">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0">
          <tr className="border-b border-line bg-surface-raised">
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted">Symbol</th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted">Entry</th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted">Exit</th>
            <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">Held (d)</th>
            <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">Return</th>
            <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-muted">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-line bg-surface last:border-b-0">
              <td className="px-3 py-2 font-medium">{t.symbol}</td>
              <td className="num px-3 py-2 text-ink-muted">
                {t.entryDate} @ {t.entryPrice.toFixed(2)}
              </td>
              <td className="num px-3 py-2 text-ink-muted">
                {t.exitDate} @ {t.exitPrice.toFixed(2)}
              </td>
              <td className="px-3 py-2">
                <NumCell value={t.holdingDays} decimals={0} />
              </td>
              <td className="px-3 py-2">
                <NumCell value={t.returnPct} suffix="%" colorBySign />
              </td>
              <td className="px-3 py-2">
                <NumCell value={t.pnl} decimals={0} colorBySign />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
