import {
  ACCOUNT_EXPORT_HEADERS,
  ACCOUNT_SHEET_NAME,
  ALLOCATION_EXPORT_HEADERS,
  ALLOCATION_SHEET_NAME,
  MEMBERS_EXPORT_HEADERS,
  MEMBERS_SHEET_NAME,
  TRANSINFO_EXPORT_HEADERS,
  TRANSINFO_SHEET_NAME,
} from "../book-export";
import type { ParsedSheet } from "../types";

/**
 * Tester dup-alloc-x3.xlsx shape: Allocation repeats the same date+member
 * three times. Import must error with the sheet and row, not emit 6-leg splits.
 */
export function dupAllocX3Sheets(): {
  transinfo: ParsedSheet;
  account: ParsedSheet;
  members: ParsedSheet;
  allocation: ParsedSheet;
} {
  const pair: [string, string, string][] = [
    ["2024-01-01", "Hey", "0.5"],
    ["2024-01-01", "Sze", "0.5"],
  ];
  return {
    transinfo: {
      kind: "transinfo",
      name: TRANSINFO_SHEET_NAME,
      headers: [...TRANSINFO_EXPORT_HEADERS],
      rows: [["NVDA", "10", "F", "2024-02-01", "10", "100", "", "", "", "", "", "", "buy", "", "T1"]],
    },
    account: {
      kind: "account",
      name: ACCOUNT_SHEET_NAME,
      headers: [...ACCOUNT_EXPORT_HEADERS],
      rows: [
        ["2024-01-01", "入金", "Hey", "1000", "1", "1000", "入"],
        ["2024-02-01", "NVDA", "F", "", "", "", ""],
      ],
    },
    members: {
      kind: "members",
      name: MEMBERS_SHEET_NAME,
      headers: [...MEMBERS_EXPORT_HEADERS],
      rows: [["Hey"], ["Sze"]],
    },
    allocation: {
      kind: "allocation",
      name: ALLOCATION_SHEET_NAME,
      headers: [...ALLOCATION_EXPORT_HEADERS],
      rows: [...pair, ...pair, ...pair],
    },
  };
}
