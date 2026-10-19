import { writeLocalXlsx } from "@/google/xlsx";
import type { AllocationScheduleView, LedgerStore } from "@/ledger/store";
import type { CashFlow, LedgerAccount, Member, Trade, TradeAllocation } from "@/ledger/types";
import {
  accountCells,
  allocationCells,
  buildExportPayload,
  memberCells,
  tradeSplitCells,
  transinfoCells,
} from "./export-payload";
import type { ParsedSheet } from "./types";

export const EXPORT_FILENAME = "book-export.xlsx";
export const TRANSINFO_SHEET_NAME = "TransInfo";
export const ACCOUNT_SHEET_NAME = "Account Detail";
export const MEMBERS_SHEET_NAME = "Members";
export const ALLOCATION_SHEET_NAME = "Allocation";

/** Headers autoMapSheet already recognizes (Chinese import template). */
export const TRANSINFO_EXPORT_HEADERS = [
  "股票代碼",
  "數量",
  "持有",
  "買入日期",
  "買入價",
  "買入總額",
  "買入手續費",
  "賣出日期",
  "賣出價",
  "手續費",
  "賣出總額",
  "盈虧",
  "種類",
  "備註",
  "TradeId",
] as const;

/** v0.1.12 and earlier: no note column, no Members/Allocation sheets. */
export const LEGACY_V012_TRANSINFO_HEADERS = [
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

export const MEMBERS_EXPORT_HEADERS = ["Name"] as const;

export const ALLOCATION_EXPORT_HEADERS = ["Effective Date", "Member", "Percent"] as const;

export const TRADE_SPLITS_SHEET_NAME = "TradeSplits";
export const TRADE_SPLITS_EXPORT_HEADERS = [
  "TradeId",
  "Date",
  "Symbol",
  "Side",
  "Member",
  "Quantity",
  "Cost",
  "Proceeds",
] as const;

export function buildBookSheets(input: {
  members: Member[];
  accounts: LedgerAccount[];
  cashFlows: CashFlow[];
  trades: Trade[];
  allocations: TradeAllocation[];
  schedules?: AllocationScheduleView[];
}): {
  transinfo: ParsedSheet;
  account: ParsedSheet;
  members: ParsedSheet;
  allocation: ParsedSheet;
  tradeSplits: ParsedSheet;
} {
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
    members: {
      kind: "members",
      name: MEMBERS_SHEET_NAME,
      headers: [...MEMBERS_EXPORT_HEADERS],
      rows: payload.members.map(memberCells),
    },
    allocation: {
      kind: "allocation",
      name: ALLOCATION_SHEET_NAME,
      headers: [...ALLOCATION_EXPORT_HEADERS],
      rows: payload.allocations.map(allocationCells),
    },
    tradeSplits: {
      kind: "tradesplits",
      name: TRADE_SPLITS_SHEET_NAME,
      headers: [...TRADE_SPLITS_EXPORT_HEADERS],
      rows: payload.tradeSplits.map(tradeSplitCells),
    },
  };
}

export async function writeBookXlsx(
  transinfo: ParsedSheet,
  account: ParsedSheet,
  extras?: { members?: ParsedSheet; allocation?: ParsedSheet; tradeSplits?: ParsedSheet },
): Promise<Uint8Array> {
  const sheets = [
    { name: TRANSINFO_SHEET_NAME, headers: transinfo.headers, rows: transinfo.rows },
    { name: ACCOUNT_SHEET_NAME, headers: account.headers, rows: account.rows },
  ];
  if (extras?.members) {
    sheets.push({ name: extras.members.name, headers: extras.members.headers, rows: extras.members.rows });
  }
  if (extras?.allocation) {
    sheets.push({
      name: extras.allocation.name,
      headers: extras.allocation.headers,
      rows: extras.allocation.rows,
    });
  }
  if (extras?.tradeSplits && extras.tradeSplits.rows.length > 0) {
    sheets.push({
      name: extras.tradeSplits.name,
      headers: extras.tradeSplits.headers,
      rows: extras.tradeSplits.rows,
    });
  }
  return writeLocalXlsx(sheets);
}

export async function exportBookXlsx(store: LedgerStore, bookId: string): Promise<Uint8Array> {
  const [members, accounts, cashFlows, trades, allocations, schedules] = await Promise.all([
    store.listMembers(bookId),
    store.listLedgerAccounts(bookId),
    store.listCashFlows(bookId),
    store.listTrades(bookId),
    store.listTradeAllocations(bookId),
    store.listAllocationSchedules(bookId),
  ]);
  const sheets = buildBookSheets({ members, accounts, cashFlows, trades, allocations, schedules });
  return writeBookXlsx(sheets.transinfo, sheets.account, {
    members: sheets.members,
    allocation: sheets.allocation.rows.length > 0 ? sheets.allocation : undefined,
    tradeSplits: sheets.tradeSplits,
  });
}
