import {
  ACCOUNT_EXPORT_HEADERS,
  ACCOUNT_SHEET_NAME,
  LEGACY_V012_TRANSINFO_HEADERS,
  TRANSINFO_SHEET_NAME,
} from "../book-export";
import type { ParsedSheet } from "../types";

/**
 * Pre-fix book-export.xlsx shape: dividends were written as kind=adjustment.
 * A Chinese-template 股息 row is also included so that recognizable old
 * dividend cells still restore the label.
 */
export function legacyExportDividendSheets(): { transinfo: ParsedSheet; account: ParsedSheet } {
  return {
    transinfo: {
      kind: "transinfo",
      name: TRANSINFO_SHEET_NAME,
      headers: [...LEGACY_V012_TRANSINFO_HEADERS],
      rows: [
        ["NVDA", "10", "B", "2024-01-02", "50", "500", "", "", "", "", "", "buy"],
        ["MSFT", "0", "B", "2024-07-01", "0", "12.5", "", "", "", "", "", "adjustment"],
        ["—", "0", "B", "2024-08-01", "0", "2.5", "", "", "", "", "", "adjustment"],
        ["AAPL", "0", "F", "2024-09-01", "0", "10", "", "", "", "", "", "股息"],
      ],
    },
    account: {
      kind: "account",
      name: ACCOUNT_SHEET_NAME,
      headers: [...ACCOUNT_EXPORT_HEADERS],
      rows: [
        ["2024-01-01", "入金", "H", "1000", "1", "1000", "入"],
        ["2024-01-02", "NVDA", "B", "", "", "", ""],
      ],
    },
  };
}
