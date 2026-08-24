import ExcelJS from "exceljs";
import { money } from "@/ledger/money";
import { positionLotsFromTrades } from "@/ledger/summary";
import type { LedgerStore } from "@/ledger/store";
import type { CashFlow, LedgerAccount, Member, Trade, TradeAllocation } from "@/ledger/types";
import { ACCOUNT_OWN } from "./own";
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

function num(value: string): string {
  try {
    return money(value).toString();
  } catch {
    return value;
  }
}

function absNum(value: string): string {
  try {
    return money(value).abs().toString();
  } catch {
    return value;
  }
}

function cashOwnForMember(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === "hey") {
    return "H";
  }
  if (key === "sze") {
    return "S";
  }
  if (key === "wah") {
    return "W";
  }
  const letter = name.trim().toUpperCase().slice(0, 1);
  return ACCOUNT_OWN[letter]?.role === "cash" ? letter : "H";
}

function tradeOwnForAccount(account: LedgerAccount | undefined, memberName: string | undefined): string {
  if (account?.kind === "joint") {
    return "F";
  }
  const cash = memberName ? cashOwnForMember(memberName) : "H";
  if (cash === "S") {
    return "A";
  }
  if (cash === "W") {
    return "D";
  }
  return "B";
}

function ownFromNote(note: string | null): string | null {
  if (!note) {
    return null;
  }
  const match = /Own\s+([A-Za-z])/i.exec(note);
  return match ? match[1].toUpperCase() : null;
}

function sumAlloc(allocations: TradeAllocation[], tradeId: string, field: "costUsd" | "proceedsUsd"): string {
  return allocations
    .filter((row) => row.tradeId === tradeId)
    .reduce((sum, row) => sum.plus(money(row[field])), money("0"))
    .toString();
}

export function buildBookSheets(input: {
  members: Member[];
  accounts: LedgerAccount[];
  cashFlows: CashFlow[];
  trades: Trade[];
  allocations: TradeAllocation[];
}): { transinfo: ParsedSheet; account: ParsedSheet } {
  const membersById = new Map(input.members.map((row) => [row.id, row]));
  const accountsById = new Map(input.accounts.map((row) => [row.id, row]));
  const tradesById = new Map(input.trades.map((row) => [row.id, row]));
  const lots = positionLotsFromTrades(input.trades, input.allocations);

  const buys = input.trades
    .filter((row) => row.side === "buy")
    .slice()
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.symbol.localeCompare(b.symbol));

  const transinfoRows: string[][] = buys.map((buy) => {
    const account = accountsById.get(buy.ledgerAccountId);
    const member = account?.memberId ? membersById.get(account.memberId) : undefined;
    const own = ownFromNote(buy.note) ?? tradeOwnForAccount(account, member?.displayName);
    const buyTotal = sumAlloc(input.allocations, buy.id, "costUsd");
    const lot = lots.find((item) => item.tradeId === buy.id);
    const sell =
      lot?.closed && lot.sellTradeIds.length === 1 ? tradesById.get(lot.sellTradeIds[0]) : undefined;
    const sellTotal = sell ? sumAlloc(input.allocations, sell.id, "proceedsUsd") : "";
    const sellFee = sell && money(sell.feeUsd).gt(0) ? num(sell.feeUsd) : "";
    let pnl = "";
    if (sell && sellTotal) {
      const fee = sellFee ? money(sellFee) : money("0");
      pnl = money(sellTotal).minus(money(buyTotal)).minus(fee).toString();
    }
    return [
      buy.symbol,
      num(buy.quantity),
      own,
      buy.occurredOn,
      num(buy.price),
      num(buyTotal),
      sell?.occurredOn ?? "",
      sell ? num(sell.price) : "",
      sellFee,
      sellTotal ? num(sellTotal) : "",
      pnl,
    ];
  });

  const accountRows: string[][] = [];
  const cashSorted = input.cashFlows
    .slice()
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  for (const flow of cashSorted) {
    const member = membersById.get(flow.memberId);
    const out = flow.kind === "withdrawal";
    accountRows.push([
      flow.occurredOn,
      out ? "出金" : "入金",
      cashOwnForMember(member?.displayName ?? ""),
      absNum(flow.amountHkd),
      num(flow.fxRate),
      absNum(flow.amountUsd),
      out ? "出" : "入",
    ]);
  }
  for (const buy of buys) {
    const account = accountsById.get(buy.ledgerAccountId);
    const member = account?.memberId ? membersById.get(account.memberId) : undefined;
    const own = tradeOwnForAccount(account, member?.displayName);
    accountRows.push([buy.occurredOn, buy.symbol, own, "", "", "", ""]);
  }

  return {
    transinfo: {
      kind: "transinfo",
      name: TRANSINFO_SHEET_NAME,
      headers: [...TRANSINFO_EXPORT_HEADERS],
      rows: transinfoRows,
    },
    account: {
      kind: "account",
      name: ACCOUNT_SHEET_NAME,
      headers: [...ACCOUNT_EXPORT_HEADERS],
      rows: accountRows,
    },
  };
}

export async function writeBookXlsx(
  transinfo: ParsedSheet,
  account: ParsedSheet,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const ti = workbook.addWorksheet(TRANSINFO_SHEET_NAME);
  ti.addRow([...TRANSINFO_EXPORT_HEADERS]);
  for (const row of transinfo.rows) {
    ti.addRow(row);
  }
  const ad = workbook.addWorksheet(ACCOUNT_SHEET_NAME);
  ad.addRow([...ACCOUNT_EXPORT_HEADERS]);
  for (const row of account.rows) {
    ad.addRow(row);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
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
