export function rollingMean(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = window - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    out[i] = sum / window;
  }
  return out;
}

export function rollingStd(values: number[], window: number): (number | null)[] {
  const means = rollingMean(values, window);
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = window - 1; i < values.length; i++) {
    const mean = means[i]!;
    let sumSq = 0;
    for (let j = i - window + 1; j <= i; j++) sumSq += (values[j] - mean) ** 2;
    out[i] = Math.sqrt(sumSq / window);
  }
  return out;
}

/** Rolling z-score, rebased to a 100-centered scale (100 + z * scale). */
export function rollingZScoreCentered(values: number[], window: number, center = 100, scale = 1): (number | null)[] {
  const means = rollingMean(values, window);
  const stds = rollingStd(values, window);
  return values.map((v, i) => {
    const mean = means[i];
    const std = stds[i];
    if (mean === null || std === null || std === 0) return null;
    return center + ((v - mean) / std) * scale;
  });
}

/** Rate of change over `period` sessions, as an absolute difference (not %). */
export function diffOverPeriod(values: (number | null)[], period: number): (number | null)[] {
  return values.map((v, i) => {
    if (v === null) return null;
    const prior = values[i - period];
    if (prior === null || prior === undefined) return null;
    return v - prior;
  });
}
