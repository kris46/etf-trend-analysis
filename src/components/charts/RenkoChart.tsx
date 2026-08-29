import { useMemo } from "react";
import type { RenkoResult } from "../../types/market";

const HEIGHT = 280;
const BRICK_GAP = 2;

export function RenkoChart({ result, maxBricks = 80 }: { result: RenkoResult; maxBricks?: number }) {
  const visible = result.bricks.slice(-maxBricks);

  const { bars, minPrice, maxPrice } = useMemo(() => {
    if (visible.length === 0) return { bars: [], minPrice: 0, maxPrice: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const b of visible) {
      min = Math.min(min, b.open, b.close);
      max = Math.max(max, b.open, b.close);
    }
    return { bars: visible, minPrice: min, maxPrice: max };
  }, [visible]);

  if (bars.length === 0) {
    return <div className="flex h-[280px] items-center justify-center text-sm text-ink-muted">Not enough data to form a brick yet</div>;
  }

  const brickWidth = 18;
  const width = bars.length * brickWidth;
  const pad = (maxPrice - minPrice) * 0.08 || 1;
  const lo = minPrice - pad;
  const hi = maxPrice + pad;
  const toY = (price: number) => HEIGHT - ((price - lo) / (hi - lo)) * HEIGHT;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block">
        {bars.map((b, i) => {
          const top = toY(Math.max(b.open, b.close));
          const bottom = toY(Math.min(b.open, b.close));
          const isBull = b.direction === "Bullish";
          return (
            <rect
              key={b.index}
              x={i * brickWidth + BRICK_GAP / 2}
              y={top}
              width={brickWidth - BRICK_GAP}
              height={Math.max(1, bottom - top)}
              fill={isBull ? "#2fd68f" : "#ff5c72"}
              opacity={0.85}
            >
              <title>
                {b.direction} brick — {b.open.toFixed(2)} → {b.close.toFixed(2)} (confirmed {b.confirmedOn})
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
