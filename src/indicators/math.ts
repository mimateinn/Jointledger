import type { Bar } from "./types";

export function sma(values: Array<number | null>, period: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  if (period <= 0) {
    return out;
  }
  for (let i = period - 1; i < values.length; i += 1) {
    let sum = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j += 1) {
      const value = values[j];
      if (value == null) {
        ok = false;
        break;
      }
      sum += value;
    }
    if (ok) {
      out[i] = sum / period;
    }
  }
  return out;
}

export function ema(values: Array<number | null>, period: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  if (period <= 0) {
    return out;
  }
  const k = 2 / (period + 1);
  const seed = sma(values, period);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null) {
      prev = null;
      continue;
    }
    if (prev == null) {
      if (seed[i] == null) {
        continue;
      }
      prev = seed[i];
      out[i] = prev;
      continue;
    }
    prev = value * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function stdev(values: Array<number | null>, period: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  for (let i = period - 1; i < values.length; i += 1) {
    const window: number[] = [];
    let broken = false;
    for (let j = i - period + 1; j <= i; j += 1) {
      const value = values[j];
      if (value == null) {
        broken = true;
        break;
      }
      window.push(value);
    }
    if (broken || window.length !== period) {
      continue;
    }
    const mean = window.reduce((sum, n) => sum + n, 0) / period;
    const variance = window.reduce((sum, n) => sum + (n - mean) ** 2, 0) / period;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

export function wilderSmooth(values: Array<number | null>, period: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  const seed = sma(values, period);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null) {
      prev = null;
      continue;
    }
    if (prev == null) {
      if (seed[i] == null) {
        continue;
      }
      prev = seed[i];
      out[i] = prev;
      continue;
    }
    prev = (prev * (period - 1) + value) / period;
    out[i] = prev;
  }
  return out;
}

export function trueRange(bars: Bar[]): Array<number | null> {
  return bars.map((bar, i) => {
    if (i === 0) {
      return bar.high - bar.low;
    }
    const prev = bars[i - 1].close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - prev), Math.abs(bar.low - prev));
  });
}

export function highest(values: number[], end: number, period: number): number | null {
  if (end < period - 1) {
    return null;
  }
  let max = -Infinity;
  for (let i = end - period + 1; i <= end; i += 1) {
    max = Math.max(max, values[i]);
  }
  return Number.isFinite(max) ? max : null;
}

export function lowest(values: number[], end: number, period: number): number | null {
  if (end < period - 1) {
    return null;
  }
  let min = Infinity;
  for (let i = end - period + 1; i <= end; i += 1) {
    min = Math.min(min, values[i]);
  }
  return Number.isFinite(min) ? min : null;
}

export function zipPoints(times: string[], values: Array<number | null>): { time: string; value: number }[] {
  const points: { time: string; value: number }[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const value = values[i];
    if (value == null || !Number.isFinite(value)) {
      continue;
    }
    points.push({ time: times[i], value });
  }
  return points;
}

export function addWeekdays(dateStr: string, n: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  let added = 0;
  while (added < n) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return date.toISOString().slice(0, 10);
}
