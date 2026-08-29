/**
 * Exponential moving average over a numeric series.
 * Returns an array the same length as `values`, with `null` for indices
 * before there's enough data to seed the average.
 */
export function ema(values: number[], period: number): (number | null)[] {
  if (period <= 0) throw new Error("period must be positive");
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  // seed with a simple average of the first `period` values
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;

  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Convenience: latest (last) value of an EMA series, or null if undefined. */
export function lastEma(values: number[], period: number): number | null {
  const series = ema(values, period);
  return series[series.length - 1];
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out[i] = sum / period;
  }
  return out;
}
