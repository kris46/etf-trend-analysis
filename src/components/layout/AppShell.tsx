import { NavLink, Outlet } from "react-router-dom";
import { useMemo } from "react";
import { useMarketStore } from "../../store/useMarketStore";
import { computeNotifications } from "../../lib/notifications";
import { NotificationsPanel } from "../common/NotificationsPanel";

export function AppShell() {
  const symbols = useMarketStore((s) => s.symbols);
  const benchmark = useMarketStore((s) => s.benchmark);
  const setBenchmark = useMarketStore((s) => s.setBenchmark);
  const indicatorsBySymbol = useMarketStore((s) => s.indicatorsBySymbol);
  const rankings = useMarketStore((s) => s.rankings);

  const notifications = useMemo(() => computeNotifications(indicatorsBySymbol, rankings), [indicatorsBySymbol, rankings]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-display text-[15px] font-semibold tracking-tight">
              ETF Intelligence <span className="text-ink-muted">/ NSE</span>
            </span>
            <nav className="flex items-center gap-1">
              <NavTab to="/">Market Overview</NavTab>
              <NavTab to="/rrg">RRG Analysis</NavTab>
              <NavTab to="/scanner">Scanner</NavTab>
              <NavTab to="/strategy">Strategy</NavTab>
              <NavTab to="/assistant">Assistant</NavTab>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              Benchmark
              <select
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                className="rounded-sm border border-line bg-surface-raised px-2 py-1 font-mono text-xs text-ink outline-none focus-visible:border-signal"
              >
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <NotificationsPanel notifications={notifications} />
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function NavTab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `rounded-sm px-3 py-1.5 text-[13px] font-medium transition-colors ${
          isActive ? "bg-signal-bg text-signal" : "text-ink-muted hover:text-ink"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
