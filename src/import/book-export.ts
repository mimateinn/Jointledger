import { writeLocalXlsx } from "@/google/xlsx";
import type { LedgerStore } from "@/ledger/store";
import type { CashFlow, LedgerAccount, Member, Trade, TradeAllocation } from "@/ledger/types";
import { accountCells, buildExportPayload, transinfoCells } from "./export-payload";
import type { ParsedSheet } from "./types";

export const EXPORT_FILENAME = "book-export.xlsx";
export const TRANSINFO_SHEET_NAME = "TransInfo";
export const ACCOUNT_SHEET_NAME = "Account Detail";

/** Headers autoMapSheet already recognizes (Chinese import template). */
export const TRANSINFO_EXPORT_HEADERS = [
  "股票代碼",
  "數量",
  "持有",
  "買入日期",
  "買入價",
  "買入總額",
  "賣出日期",
  "賣出價",
  "手續費",
  "賣出總額",
  "盈虧",
  "種類",
] as const;

export const ACCOUNT_EXPORT_HEADERS = [
  "日期",
  "明細",
  "持有",
  "港元",
  "匯率",
  "美元",
  "出入金",
] as const;

export function buildBookSheets(input: {
  members: Member[];
  accounts: LedgerAccount[];
  cashFlows: CashFlow[];
  trades: Trade[];
  allocations: TradeAllocation[];
}): { transinfo: ParsedSheet; account: ParsedSheet } {
  const payload = buildExportPayload(input);
  return {
    transinfo: {
      kind: "transinfo",
      name: TRANSINFO_SHEET_NAME,
      headers: [...TRANSINFO_EXPORT_HEADERS],
      rows: payload.transinfo.map(transinfoCells),
    },
    account: {
      kind: "account",
      name: ACCOUNT_SHEET_NAME,
      headers: [...ACCOUNT_EXPORT_HEADERS],
      rows: payload.account.map(accountCells),
    },
  };
}

export async function writeBookXlsx(
  transinfo: ParsedSheet,
  account: ParsedSheet,
): Promise<Uint8Array> {
  return writeLocalXlsx([
    { name: TRANSINFO_SHEET_NAME, headers: TRANSINFO_EXPORT_HEADERS, rows: transinfo.rows },
    { name: ACCOUNT_SHEET_NAME, headers: ACCOUNT_EXPORT_HEADERS, rows: account.rows },
  ]);
}

export async function exportBookXlsx(store: LedgerStore, bookId: string): Promise<Uint8Array> {
  const [members, accounts, cashFlows, trades, allocations] = await Promise.all([
    store.listMembers(bookId),
    store.listLedgerAccounts(bookId),
    store.listCashFlows(bookId),
    store.listTrades(bookId),
    store.listTradeAllocations(bookId),
  ]);
  const sheets = buildBookSheets({ members, accounts, cashFlows, trades, allocations });
  return writeBookXlsx(sheets.transinfo, sheets.account);
}
