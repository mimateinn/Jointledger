import { money } from "@/ledger/money";
import { positionLotsFromTrades } from "@/ledger/summary";
import type { CashFlow, LedgerAccount, Member, Trade, TradeAllocation } from "@/ledger/types";
import { ACCOUNT_OWN } from "./own";
import type { RowKind } from "./row-kind";

export type TransInfoExportRow = {
  kind: RowKind;
  symbol: string;
  quantity: string;
  own: string;
  buyDate: string;
  buyPrice: string;
  buyTotal: string;
  sellDate: string;
  sellPrice: string;
  sellFee: string;
  sellTotal: string;
  pnl: string;
};

export type AccountExportRow = {
  date: string;
  detail: string;
  own: string;
  hkd: string;
  fx: string;
  usd: string;
  inOut: string;
};

export type BookExportPayload = {
  transinfo: TransInfoExportRow[];
  account: AccountExportRow[];
};

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

export function buildExportPayload(input: {
  members: Member[];
  accounts: LedgerAccount[];
  cashFlows: CashFlow[];
  trades: Trade[];
  allocations: TradeAllocation[];
}): BookExportPayload {
  const membersById = new Map(input.members.map((row) => [row.id, row]));
  const accountsById = new Map(input.accounts.map((row) => [row.id, row]));
  const tradesById = new Map(input.trades.map((row) => [row.id, row]));
  const lots = positionLotsFromTrades(input.trades, input.allocations);

  const transinfo: TransInfoExportRow[] = [];
  const tradeRows = input.trades
    .filter((row) => row.side === "buy" || row.side === "split" || row.side === "adjustment")
    .slice()
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.symbol.localeCompare(b.symbol));

  for (const trade of tradeRows) {
    const account = accountsById.get(trade.ledgerAccountId);
    const member = account?.memberId ? membersById.get(account.memberId) : undefined;
    const own = ownFromNote(trade.note) ?? tradeOwnForAccount(account, member?.displayName);
    if (trade.side === "split") {
      transinfo.push({
        kind: "split",
        symbol: trade.symbol,
        quantity: num(trade.quantity),
        own,
        buyDate: trade.occurredOn,
        buyPrice: num(trade.price),
        buyTotal: "0",
        sellDate: "",
        sellPrice: "",
        sellFee: "",
        sellTotal: "",
        pnl: "",
      });
      continue;
    }
    if (trade.side === "adjustment") {
      const impact = sumAlloc(input.allocations, trade.id, "proceedsUsd");
      const cost = sumAlloc(input.allocations, trade.id, "costUsd");
      transinfo.push({
        kind: "adjustment",
        symbol: trade.symbol,
        quantity: num(trade.quantity),
        own,
        buyDate: trade.occurredOn,
        buyPrice: "0",
        buyTotal: money(impact).gt(0) ? num(impact) : num(cost),
        sellDate: "",
        sellPrice: "",
        sellFee: "",
        sellTotal: "",
        pnl: "",
      });
      continue;
    }

    const buyTotal = sumAlloc(input.allocations, trade.id, "costUsd");
    const lot = lots.find((item) => item.tradeId === trade.id);
    const sell =
      lot?.closed && lot.sellTradeIds.length === 1 ? tradesById.get(lot.sellTradeIds[0]) : undefined;
    const sellTotal = sell ? sumAlloc(input.allocations, sell.id, "proceedsUsd") : "";
    const sellFee = sell && money(sell.feeUsd).gt(0) ? num(sell.feeUsd) : "";
    let pnl = "";
    if (sell && sellTotal) {
      const fee = sellFee ? money(sellFee) : money("0");
      pnl = money(sellTotal).minus(money(buyTotal)).minus(fee).toString();
    }
    transinfo.push({
      kind: "buy",
      symbol: trade.symbol,
      quantity: num(trade.quantity),
      own,
      buyDate: trade.occurredOn,
      buyPrice: num(trade.price),
      buyTotal: num(buyTotal),
      sellDate: sell?.occurredOn ?? "",
      sellPrice: sell ? num(sell.price) : "",
      sellFee,
      sellTotal: sellTotal ? num(sellTotal) : "",
      pnl,
    });
  }

  const account: AccountExportRow[] = [];
  const cashSorted = input.cashFlows.slice().sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  for (const flow of cashSorted) {
    const member = membersById.get(flow.memberId);
    const out = flow.kind === "withdrawal";
    account.push({
      date: flow.occurredOn,
      detail: out ? "出金" : "入金",
      own: cashOwnForMember(member?.displayName ?? ""),
      hkd: absNum(flow.amountHkd),
      fx: num(flow.fxRate),
      usd: absNum(flow.amountUsd),
      inOut: out ? "出" : "入",
    });
  }
  for (const row of transinfo.filter((item) => item.kind === "buy")) {
    account.push({
      date: row.buyDate,
      detail: row.symbol,
      own: row.own,
      hkd: "",
      fx: "",
      usd: "",
      inOut: "",
    });
  }

  return { transinfo, account };
}

export function transinfoCells(row: TransInfoExportRow): string[] {
  return [
    row.symbol,
    row.quantity,
    row.own,
    row.buyDate,
    row.buyPrice,
    row.buyTotal,
    row.sellDate,
    row.sellPrice,
    row.sellFee,
    row.sellTotal,
    row.pnl,
    row.kind,
  ];
}

export function accountCells(row: AccountExportRow): string[] {
  return [row.date, row.detail, row.own, row.hkd, row.fx, row.usd, row.inOut];
}
