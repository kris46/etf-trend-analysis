import type { ExplainabilityResult } from "../../types/market";
import { SignalBadge } from "./SignalBadge";

export function ExplainabilityCard({ result }: { result: ExplainabilityResult }) {
  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Signal</span>
        <SignalBadge label={result.signal} />
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Confidence</span>
        <span className="num text-ink">{result.confidence}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {result.reasons.map((reason) => (
          <li key={reason.text} className="flex items-center gap-2 text-[13px]">
            <span className={reason.supportsSignal ? "text-bull" : "text-bear"}>{reason.supportsSignal ? "✓" : "✗"}</span>
            <span className={reason.supportsSignal ? "text-ink" : "text-ink-muted"}>{reason.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
