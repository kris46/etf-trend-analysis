export function StatCard({
  label,
  value,
  suffix = "",
  tone = "neutral",
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "bull" | "bear" | "watch" | "neutral";
}) {
  const toneClass = {
    bull: "text-bull",
    bear: "text-bear",
    watch: "text-watch",
    neutral: "text-ink",
  }[tone];

  return (
    <div className="rounded-sm border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`num mt-1 text-xl font-medium ${toneClass}`}>
        {value}
        <span className="text-sm text-ink-muted">{suffix}</span>
      </div>
    </div>
  );
}
