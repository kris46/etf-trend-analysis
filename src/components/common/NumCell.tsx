export function NumCell({
  value,
  suffix = "",
  decimals = 2,
  colorBySign = false,
  align = "right",
}: {
  value: number | null | undefined;
  suffix?: string;
  decimals?: number;
  colorBySign?: boolean;
  align?: "right" | "left";
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="num text-ink-faint" style={{ textAlign: align }}>—</span>;
  }

  const colorClass = colorBySign ? (value > 0 ? "text-bull" : value < 0 ? "text-bear" : "text-ink-muted") : "text-ink";
  const sign = colorBySign && value > 0 ? "+" : "";

  return (
    <span className={`num ${colorClass}`} style={{ textAlign: align, display: "inline-block", width: "100%" }}>
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
