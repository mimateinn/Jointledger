import {
  ACCOUNT_EXPORT_HEADERS,
  ACCOUNT_SHEET_NAME,
  LEGACY_V012_TRANSINFO_HEADERS,
  TRANSINFO_SHEET_NAME,
} from "../book-export";
import type { ParsedSheet } from "../types";

/**
 * v0.1.12 two-sheet file with only H cash and an F (joint) buy — no S cash,
 * no Members, no Allocation. F must become Hey/Sze 50/50 and create Sze.
 */
export function legacyV012FOnlyExportSheets(): { transinfo: ParsedSheet; account: ParsedSheet } {
  return {
    transinfo: {
      kind: "transinfo",
      name: TRANSINFO_SHEET_NAME,
      headers: [...LEGACY_V012_TRANSINFO_HEADERS],
      rows: [["NVDA", "10", "F", "2024-02-01", "10", "100", "", "", "", "", "", "buy"]],
    },
    account: {
      kind: "account",
      name: ACCOUNT_SHEET_NAME,
      headers: [...ACCOUNT_EXPORT_HEADERS],
      rows: [
        ["2024-01-01", "入金", "H", "1000", "1", "1000", "入"],
        ["2024-02-01", "NVDA", "F", "", "", "", ""],
      ],
    },
  };
}
