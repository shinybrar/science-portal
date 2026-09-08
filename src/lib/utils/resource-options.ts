function isConsecutiveIntegers(options: number[]): boolean {
  if (options.length < 2) return false;
  for (let i = 1; i < options.length; i++) {
    if (options[i] !== options[i - 1] + 1) return false;
  }
  return true;
}

function consecutiveTickStep(span: number, maxMarks: number): number {
  const candidates = [4, 8, 16, 32, 64, 128];
  for (const step of candidates) {
    if (Math.floor(span / step) + 1 <= maxMarks) return step;
  }
  return candidates[candidates.length - 1];
}

export function resourceSliderMarkIndices(options: number[], maxMarks: number = 13): number[] {
  if (options.length === 0) return [];
  if (options.length <= maxMarks) {
    return options.map((_, index) => index);
  }

  const last = options.length - 1;
  const indices = new Set<number>([0, last]);

  if (isConsecutiveIntegers(options)) {
    const lo = options[0];
    const hi = options[last];
    const step = consecutiveTickStep(hi - lo, maxMarks);
    const firstTick = Math.ceil(lo / step) * step;
    for (let value = firstTick; value <= hi; value += step) {
      const index = value - lo;
      if (index > 0 && index < last) indices.add(index);
    }
  } else {
    const inner = maxMarks - 2;
    for (let i = 1; i <= inner; i++) {
      indices.add(Math.round((i * last) / (inner + 1)));
    }
  }

  return [...indices].sort((left, right) => left - right);
}

export function nearestOption(value: number, options: readonly number[]): number {
  return options.reduce(
    (best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best),
    value,
  );
}
