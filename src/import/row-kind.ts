export const ROW_KINDS = ["buy", "sell", "split", "adjustment"] as const;
export type RowKind = (typeof ROW_KINDS)[number];

export function parseRowKind(raw: string | null | undefined): RowKind | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) {
    return null;
  }
  if (value === "buy" || value === "買入") {
    return "buy";
  }
  if (value === "sell" || value === "賣出") {
    return "sell";
  }
  if (value === "split" || value === "拆股") {
    return "split";
  }
  if (value === "adjustment" || value === "調整") {
    return "adjustment";
  }
  return null;
}

/** Import writes buys (and sells via the buy row). Split/adjustment stay bookkeeping-only. */
export function isImportSkippedKind(kind: RowKind | null): boolean {
  return kind === "split" || kind === "adjustment";
}

export function rowKindLabel(kind: RowKind): string {
  if (kind === "split") {
    return "拆股";
  }
  if (kind === "adjustment") {
    return "調整";
  }
  if (kind === "sell") {
    return "賣出";
  }
  return "買入";
}
