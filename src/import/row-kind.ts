import { isDividendNote } from "@/ledger/dividend";

export const ROW_KINDS = ["buy", "sell", "split", "adjustment"] as const;
export type RowKind = (typeof ROW_KINDS)[number];
/** Spreadsheet token. Dividends stay adjustment in SQLite; only the export cell differs. */
export type ExportRowKind = RowKind | "dividend";

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
  if (value === "adjustment" || value === "調整" || value === "dividend" || value === "股息") {
    return "adjustment";
  }
  return null;
}

/** Kind cell that means "this adjustment is a dividend" (new export + Chinese sheets). */
export function isDividendKindRaw(raw: string | null | undefined): boolean {
  return /股息|dividend/i.test((raw ?? "").trim());
}

/** Write "dividend" so re-import can restore the 股息 note prefix. */
export function exportRowKind(kind: RowKind, note?: string | null): ExportRowKind {
  if (kind === "adjustment" && isDividendNote(note)) {
    return "dividend";
  }
  return kind;
}

/** Split and adjustment rows are imported (quantity/price = new/old shares for splits). */

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
