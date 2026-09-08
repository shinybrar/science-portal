const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const DIVISORS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 86400 * 365],
  ['month', 86400 * 30],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

export function formatRelativeToNow(thenMs: number, nowMs: number): string {
  const diffSec = Math.round((thenMs - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  const [unit, secs] = DIVISORS.find(([, size]) => abs >= size) ?? ['second', 1];
  return relativeTimeFormatter.format(Math.round(diffSec / secs), unit);
}
