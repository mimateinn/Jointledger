import type { Bar, PriceDomain } from "./types";

/** Domain from this series only. Empty → null. Never a borrowed fallback. */
export function priceDomain(bars: readonly Bar[]): PriceDomain | null {
  if (bars.length === 0) {
    return null;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const bar of bars) {
    if (Number.isFinite(bar.low)) {
      min = Math.min(min, bar.low);
    }
    if (Number.isFinite(bar.high)) {
      max = Math.max(max, bar.high);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  return { min, max };
}

export function priceFormatFromBars(bars: readonly Bar[]): { precision: number; minMove: number } {
  const last = bars[bars.length - 1]?.close;
  if (last == null || !Number.isFinite(last)) {
    return { precision: 2, minMove: 0.01 };
  }
  if (last >= 1000) {
    return { precision: 2, minMove: 0.01 };
  }
  if (last >= 10) {
    return { precision: 2, minMove: 0.01 };
  }
  return { precision: 4, minMove: 0.0001 };
}
