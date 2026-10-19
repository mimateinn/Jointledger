import {
  ACCOUNT_EXPORT_HEADERS,
  ACCOUNT_SHEET_NAME,
  LEGACY_V012_TRANSINFO_HEADERS,
  TRANSINFO_SHEET_NAME,
} from "../book-export";
import type { ParsedSheet } from "../types";

/**
 * v0.1.12 two-sheet export: F / 聯名（Hey + Sze） mean Hey/Sze 50/50
 * even when Wah is also a member of the book.
 */
export function legacyV012WahExportSheets(): { transinfo: ParsedSheet; account: ParsedSheet } {
  return {
    transinfo: {
      kind: "transinfo",
      name: TRANSINFO_SHEET_NAME,
      headers: [...LEGACY_V012_TRANSINFO_HEADERS],
      rows: [
        ["NVDA", "10", "F", "2024-02-01", "20", "200", "", "", "", "", "", "buy"],
        ["AAPL", "4", "聯名（Hey + Sze）", "2024-03-01", "10", "40", "", "", "", "", "", "buy"],
      ],
    },
    account: {
      kind: "account",
      name: ACCOUNT_SHEET_NAME,
      headers: [...ACCOUNT_EXPORT_HEADERS],
      rows: [
        ["2024-01-01", "入金", "H", "1000", "1", "1000", "入"],
        ["2024-01-01", "入金", "S", "1000", "1", "1000", "入"],
        ["2024-01-01", "入金", "W", "1000", "1", "1000", "入"],
        ["2024-02-01", "NVDA", "F", "", "", "", ""],
        ["2024-03-01", "AAPL", "F", "", "", "", ""],
      ],
    },
  };
}
