import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Notification } from "../../lib/notifications";

const SEVERITY_DOT: Record<Notification["severity"], string> = {
  bull: "bg-bull",
  bear: "bg-bear",
  info: "bg-signal",
};

export function NotificationsPanel({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-sm border border-line bg-surface-raised px-2.5 py-1.5 text-xs text-ink-muted hover:text-ink"
        aria-label="Notifications"
      >
        🔔
        {notifications.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-medium text-canvas">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-sm border border-line bg-surface shadow-lg">
            <div className="border-b border-line px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Today's notable events
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-4 text-sm text-ink-muted">Nothing notable today.</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setOpen(false);
                      navigate(`/etf/${n.symbol}`);
                    }}
                    className="flex w-full items-start gap-2 border-b border-line px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-surface-raised"
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${SEVERITY_DOT[n.severity]}`} />
                    <span className="text-ink">{n.message}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
