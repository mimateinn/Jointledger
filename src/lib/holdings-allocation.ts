export type AllocDimension = "market" | "currency" | "member";
export type AllocBasis = "market" | "cost";

export type AllocLot = {
  symbol: string;
  memberLabel?: string;
  marketValueUsd: string | null;
  costUsd: string;
  lastDisplay: string | null;
  percentChange?: string | null;
};

export type AllocSlice = {
  key: string;
  label: string;
  value: number;
  pct: number;
  todayPct: number | null;
};

export type AllocResult = {
  slices: AllocSlice[];
  total: number;
  missingPrice: number;
  singleGroup: boolean;
};

const MARKET_LABEL: Record<string, string> = {
  US: "美股",
  HK: "港股",
  JP: "日股",
  KR: "韓股",
  CN: "中資",
  OTHER: "其他",
};

export function marketKeyFromSymbol(symbol: string): keyof typeof MARKET_LABEL {
  const code = symbol.toUpperCase();
  if (code.endsWith(".HK")) return "HK";
  if (code.endsWith(".T") || code.endsWith(".JP")) return "JP";
  if (code.endsWith(".KS") || code.endsWith(".KQ")) return "KR";
  if (code.endsWith(".SS") || code.endsWith(".SZ")) return "CN";
  if (code.includes("-USD") || code.endsWith(".FX")) return "OTHER";
  return "US";
}

export function currencyKeyFromSymbol(symbol: string): "USD" | "HKD" | "OTHER" {
  const market = marketKeyFromSymbol(symbol);
  if (market === "HK") return "HKD";
  if (market === "US") return "USD";
  return "OTHER";
}

function lotValue(lot: AllocLot, basis: AllocBasis): number {
  if (basis === "market" && lot.lastDisplay && lot.marketValueUsd) {
    const n = Number(lot.marketValueUsd);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  const cost = Number(lot.costUsd);
  return Number.isFinite(cost) ? Math.max(0, cost) : 0;
}

function lotTodayUsd(lot: AllocLot): number | null {
  if (!lot.lastDisplay || !lot.marketValueUsd || !lot.percentChange) {
    return null;
  }
  const pct = Number(lot.percentChange.replace("%", ""));
  const mv = Number(lot.marketValueUsd);
  if (!Number.isFinite(pct) || !Number.isFinite(mv) || pct === -100) {
    return null;
  }
  return mv - mv / (1 + pct / 100);
}

export function buildAllocation(
  lots: AllocLot[],
  dimension: AllocDimension,
  basis: AllocBasis = "market",
): AllocResult {
  const groups = new Map<string, { label: string; value: number; today: number; todayKnown: boolean }>();
  let missingPrice = 0;

  for (const lot of lots) {
    if (!lot.lastDisplay) {
      missingPrice += 1;
    }
    let key = "OTHER";
    let label = "其他";
    if (dimension === "market") {
      key = marketKeyFromSymbol(lot.symbol);
      label = MARKET_LABEL[key];
    } else if (dimension === "currency") {
      key = currencyKeyFromSymbol(lot.symbol);
      label = key;
    } else {
      key = lot.memberLabel || "—";
      label = key;
    }
    const value = lotValue(lot, basis);
    const today = lotTodayUsd(lot);
    const cur = groups.get(key) ?? { label, value: 0, today: 0, todayKnown: false };
    cur.value += value;
    if (today != null) {
      cur.today += today;
      cur.todayKnown = true;
    }
    groups.set(key, cur);
  }

  const total = [...groups.values()].reduce((sum, row) => sum + row.value, 0);
  const raw = [...groups.entries()]
    .map(([key, row]) => ({
      key,
      label: row.label,
      value: row.value,
      pct: total > 0 ? (row.value / total) * 100 : 0,
      todayPct: row.todayKnown && row.value - row.today !== 0 ? (row.today / (row.value - row.today)) * 100 : null,
    }))
    .sort((a, b) => b.value - a.value);

  const head = raw.slice(0, 5);
  const rest = raw.slice(5);
  if (rest.length > 0) {
    const otherValue = rest.reduce((sum, row) => sum + row.value, 0);
    head.push({
      key: "other",
      label: "其他",
      value: otherValue,
      pct: total > 0 ? (otherValue / total) * 100 : 0,
      todayPct: null,
    });
  }

  return {
    slices: total > 0 ? roundSlicesToHundred(head) : head.map((slice) => ({ ...slice, pct: 0 })),
    total,
    missingPrice,
    singleGroup: head.length <= 1,
  };
}

function roundSlicesToHundred(slices: AllocSlice[]): AllocSlice[] {
  if (slices.length === 0) {
    return slices;
  }
  const rounded = slices.map((slice) => ({ ...slice, pct: Math.round(slice.pct * 10) / 10 }));
  const sum = rounded.reduce((acc, slice) => acc + slice.pct, 0);
  const diff = Math.round((100 - sum) * 10) / 10;
  if (diff === 0) {
    return rounded;
  }
  let best = 0;
  for (let i = 1; i < rounded.length; i += 1) {
    if (rounded[i].value > rounded[best].value) {
      best = i;
    }
  }
  rounded[best] = { ...rounded[best], pct: Math.round((rounded[best].pct + diff) * 10) / 10 };
  return rounded;
}

export const ALLOC_INK_MIX = [100, 75, 55, 40, 28, 18];

export function allocColor(index: number): string {
  const mix = ALLOC_INK_MIX[index] ?? 18;
  return `color-mix(in srgb, var(--ink) ${mix}%, var(--surface))`;
}
