import {
  ACCOUNT_EXPORT_HEADERS,
  ACCOUNT_SHEET_NAME,
  LEGACY_V012_TRANSINFO_HEADERS,
  TRANSINFO_SHEET_NAME,
} from "../book-export";
import type { ParsedSheet } from "../types";

/**
 * Book export shape from v0.1.12 and earlier: two sheets, letter holders,
 * no note column, no Members sheet, no Allocation sheet, sells inlined on buys.
 */
export function legacyV012ExportSheets(): { transinfo: ParsedSheet; account: ParsedSheet } {
  return {
    transinfo: {
      kind: "transinfo",
      name: TRANSINFO_SHEET_NAME,
      headers: [...LEGACY_V012_TRANSINFO_HEADERS],
      rows: [
        ["NVDA", "10", "B", "2024-01-02", "50", "500", "", "", "", "", "", "buy"],
        ["AAPL", "5", "F", "2024-02-01", "20", "100", "2024-03-01", "25", "1", "125", "24", "buy"],
        ["MSFT", "2", "A", "2024-04-01", "10", "20", "", "", "", "", "", "buy"],
      ],
    },
    account: {
      kind: "account",
      name: ACCOUNT_SHEET_NAME,
      headers: [...ACCOUNT_EXPORT_HEADERS],
      rows: [
        ["2024-01-01", "入金", "H", "1000", "1", "1000", "入"],
        ["2024-01-01", "入金", "S", "400", "1", "400", "入"],
        ["2024-01-02", "NVDA", "B", "", "", "", ""],
        ["2024-02-01", "AAPL", "F", "", "", "", ""],
        ["2024-04-01", "MSFT", "A", "", "", "", ""],
      ],
    },
  };
}
