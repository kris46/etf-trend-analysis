type Tone = "bull" | "bear" | "watch" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  bull: "text-bull bg-bull-bg border-bull/30",
  bear: "text-bear bg-bear-bg border-bear/30",
  watch: "text-watch bg-watch-bg border-watch/30",
  neutral: "text-ink-muted bg-surface-raised border-line",
};

const SIGNAL_TONE: Record<string, Tone> = {
  BUY: "bull",
  Bullish: "bull",
  Accumulation: "bull",
  Leading: "bull",
  Improving: "bull",
  WATCH: "watch",
  Neutral: "watch",
  Weakening: "watch",
  SELL: "bear",
  AVOID: "bear",
  Bearish: "bear",
  Distribution: "bear",
  Lagging: "bear",
};

export function SignalBadge({ label, tone }: { label: string; tone?: Tone }) {
  const resolved = tone ?? SIGNAL_TONE[label] ?? "neutral";
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-mono font-medium uppercase tracking-wide ${TONE_CLASSES[resolved]}`}
    >
      {label}
    </span>
  );
}
