import { jointTradeLegs } from "@/ledger/joint-legs";
import { money } from "@/ledger/money";
import { scheduleInForce } from "@/ledger/set-allocation-schedule";
import type { AllocationScheduleView } from "@/ledger/store";
import { tradeCashAmountUsd } from "@/ledger/trade-amount";
import type { CashFlow, LedgerAccount, Member, Trade, TradeAllocation } from "@/ledger/types";
import { cashOwnForMember, jointHolderToken, tradeOwnForAccount } from "./own";
import { exportRowKind, type ExportRowKind } from "./row-kind";

export type TransInfoExportRow = {
  tradeId: string;
  kind: ExportRowKind;
  symbol: string;
  quantity: string;
  own: string;
  buyDate: string;
  buyPrice: string;
  buyTotal: string;
  buyFee: string;
  sellDate: string;
  sellPrice: string;
  sellFee: string;
  sellTotal: string;
  pnl: string;
  note: string;
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

export type MemberExportRow = {
  name: string;
};

export type AllocationExportRow = {
  effectiveOn: string;
  memberName: string;
  percent: string;
};

export type TradeSplitExportRow = {
  tradeId: string;
  occurredOn: string;
  symbol: string;
  side: string;
  memberName: string;
  quantity: string;
  costUsd: string;
  proceedsUsd: string;
};

export type BookExportPayload = {
  transinfo: TransInfoExportRow[];
  account: AccountExportRow[];
  members: MemberExportRow[];
  allocations: AllocationExportRow[];
  tradeSplits: TradeSplitExportRow[];
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

function sumAlloc(allocations: TradeAllocation[], tradeId: string, field: "costUsd" | "proceedsUsd"): string {
  return allocations
    .filter((row) => row.tradeId === tradeId)
    .reduce((sum, row) => sum.plus(money(row[field])), money("0"))
    .toString();
}

function holderForTrade(
  trade: Trade,
  accountsById: Map<string, LedgerAccount>,
  membersById: Map<string, Member>,
  jointToken: string,
): string {
  const account = accountsById.get(trade.ledgerAccountId);
  const member = account?.memberId ? membersById.get(account.memberId) : undefined;
  return tradeOwnForAccount(account?.kind, member?.displayName, jointToken);
}

function percentCell(value: string): string {
  try {
    return money(value).toFixed(8);
  } catch {
    return value;
  }
}

function feeCell(value: string): string {
  try {
    return money(value).gt(0) ? num(value) : "";
  } catch {
    return value;
  }
}

export function buildExportPayload(input: {
  members: Member[];
  accounts: LedgerAccount[];
  cashFlows: CashFlow[];
  trades: Trade[];
  allocations: TradeAllocation[];
  schedules?: AllocationScheduleView[];
}): BookExportPayload {
  const membersById = new Map(input.members.map((row) => [row.id, row]));
  const accountsById = new Map(input.accounts.map((row) => [row.id, row]));
  const jointToken = jointHolderToken(input.members.map((row) => row.displayName));

  const transinfo: TransInfoExportRow[] = [];
  const tradeRows = input.trades.slice().sort((a, b) => {
    const ownA = holderForTrade(a, accountsById, membersById, jointToken);
    const ownB = holderForTrade(b, accountsById, membersById, jointToken);
    const keyA = `${a.occurredOn}|${a.side}|${a.symbol}|${a.quantity}|${ownA}|${a.note ?? ""}`;
    const keyB = `${b.occurredOn}|${b.side}|${b.symbol}|${b.quantity}|${ownB}|${b.note ?? ""}`;
    return keyA.localeCompare(keyB);
  });
  const exportIds = new Map(tradeRows.map((trade, index) => [trade.id, `T${index + 1}`]));

  for (const trade of tradeRows) {
    const own = holderForTrade(trade, accountsById, membersById, jointToken);
    const note = trade.note ?? "";
    if (trade.side === "split") {
      transinfo.push({
        tradeId: exportIds.get(trade.id) ?? trade.id,
        kind: "split",
        symbol: trade.symbol,
        quantity: num(trade.quantity),
        own,
        buyDate: trade.occurredOn,
        buyPrice: num(trade.price),
        buyTotal: "0",
        buyFee: "",
        sellDate: "",
        sellPrice: "",
        sellFee: "",
        sellTotal: "",
        pnl: "",
        note,
      });
      continue;
    }
    if (trade.side === "adjustment") {
      const amountUsd = tradeCashAmountUsd({
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        allocations: input.allocations.filter((row) => row.tradeId === trade.id),
      });
      transinfo.push({
        tradeId: exportIds.get(trade.id) ?? trade.id,
        kind: exportRowKind("adjustment", trade.note),
        symbol: trade.symbol,
        quantity: num(trade.quantity),
        own,
        buyDate: trade.occurredOn,
        buyPrice: "0",
        buyTotal: num(amountUsd),
        buyFee: "",
        sellDate: "",
        sellPrice: "",
        sellFee: "",
        sellTotal: "",
        pnl: "",
        note,
      });
      continue;
    }
    if (trade.side === "sell") {
      const sellTotal = sumAlloc(input.allocations, trade.id, "proceedsUsd");
      transinfo.push({
        tradeId: exportIds.get(trade.id) ?? trade.id,
        kind: "sell",
        symbol: trade.symbol,
        quantity: num(trade.quantity),
        own,
        buyDate: "",
        buyPrice: "",
        buyTotal: "",
        buyFee: "",
        sellDate: trade.occurredOn,
        sellPrice: num(trade.price),
        sellFee: feeCell(trade.feeUsd),
        sellTotal: sellTotal ? num(sellTotal) : "",
        pnl: "",
        note,
      });
      continue;
    }

    const buyTotal = sumAlloc(input.allocations, trade.id, "costUsd");
    transinfo.push({
      tradeId: exportIds.get(trade.id) ?? trade.id,
      kind: "buy",
      symbol: trade.symbol,
      quantity: num(trade.quantity),
      own,
      buyDate: trade.occurredOn,
      buyPrice: num(trade.price),
      buyTotal: num(buyTotal),
      buyFee: feeCell(trade.feeUsd),
      sellDate: "",
      sellPrice: "",
      sellFee: "",
      sellTotal: "",
      pnl: "",
      note,
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

  const members: MemberExportRow[] = input.members
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((row) => ({ name: row.displayName }));

  const allocations: AllocationExportRow[] = [];
  const schedules = (input.schedules ?? [])
    .slice()
    .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn));
  if (schedules.length > 0) {
    for (const schedule of schedules) {
      const legs = schedule.legs.slice().sort((a, b) => {
        const nameA = membersById.get(a.memberId)?.displayName ?? a.memberId;
        const nameB = membersById.get(b.memberId)?.displayName ?? b.memberId;
        return nameA.localeCompare(nameB);
      });
      for (const leg of legs) {
        const memberName = membersById.get(leg.memberId)?.displayName;
        if (!memberName) {
          continue;
        }
        allocations.push({
          effectiveOn: schedule.effectiveOn,
          memberName,
          percent: percentCell(leg.percent),
        });
      }
    }
  }

  const tradeSplits = collectCustomTradeSplits({
    tradeRows,
    exportIds,
    accountsById,
    membersById,
    members: input.members,
    allocations: input.allocations,
    schedules: input.schedules ?? [],
  });

  return { transinfo, account, members, allocations, tradeSplits };
}

function collectCustomTradeSplits(input: {
  tradeRows: Trade[];
  exportIds: Map<string, string>;
  accountsById: Map<string, LedgerAccount>;
  membersById: Map<string, Member>;
  members: Member[];
  allocations: TradeAllocation[];
  schedules: AllocationScheduleView[];
}): TradeSplitExportRow[] {
  const tradeSplits: TradeSplitExportRow[] = [];
  for (const trade of input.tradeRows) {
    const account = input.accountsById.get(trade.ledgerAccountId);
    if (account?.kind !== "joint") {
      continue;
    }
    const actual = input.allocations.filter((row) => row.tradeId === trade.id);
    if (actual.length === 0) {
      continue;
    }
    if (trade.side === "split") {
      const sorted = actual.slice().sort((a, b) => {
        const nameA = input.membersById.get(a.memberId)?.displayName ?? a.memberId;
        const nameB = input.membersById.get(b.memberId)?.displayName ?? b.memberId;
        return nameA.localeCompare(nameB);
      });
      for (const leg of sorted) {
        const memberName = input.membersById.get(leg.memberId)?.displayName;
        if (!memberName) {
          continue;
        }
        tradeSplits.push({
          tradeId: input.exportIds.get(trade.id) ?? trade.id,
          occurredOn: trade.occurredOn,
          symbol: trade.symbol,
          side: trade.side,
          memberName,
          quantity: num(leg.quantity),
          costUsd: num(leg.costUsd),
          proceedsUsd: num(leg.proceedsUsd),
        });
      }
      continue;
    }
    const field =
      trade.side === "sell" || actual.some((row) => money(row.proceedsUsd).gt(0)) ? "proceeds" : "cost";
    const total = actual.reduce(
      (sum, row) => sum.plus(money(row[field === "cost" ? "costUsd" : "proceedsUsd"])),
      money("0"),
    );
    const schedule = scheduleInForce(input.schedules, trade.occurredOn);
    const expected = jointTradeLegs({
      scheduleLegs: schedule?.legs ?? null,
      members: input.members,
      quantity: trade.quantity,
      total: total.toString(),
      field,
    });
    const expectedByMember = new Map(
      expected.map((leg) => [
        leg.memberId,
        {
          quantity: money(leg.quantity),
          costUsd: money(leg.costUsd ?? "0"),
          proceedsUsd: money(leg.proceedsUsd ?? "0"),
        },
      ]),
    );
    const custom =
      actual.length !== expected.length ||
      actual.some((row) => {
        const want = expectedByMember.get(row.memberId);
        return (
          !want ||
          !money(row.quantity).eq(want.quantity) ||
          !money(row.costUsd).eq(want.costUsd) ||
          !money(row.proceedsUsd).eq(want.proceedsUsd)
        );
      });
    if (!custom) {
      continue;
    }
    const sorted = actual.slice().sort((a, b) => {
      const nameA = input.membersById.get(a.memberId)?.displayName ?? a.memberId;
      const nameB = input.membersById.get(b.memberId)?.displayName ?? b.memberId;
      return nameA.localeCompare(nameB);
    });
    for (const leg of sorted) {
      const memberName = input.membersById.get(leg.memberId)?.displayName;
      if (!memberName) {
        continue;
      }
      tradeSplits.push({
        tradeId: input.exportIds.get(trade.id) ?? trade.id,
        occurredOn: trade.occurredOn,
        symbol: trade.symbol,
        side: trade.side,
        memberName,
        quantity: num(leg.quantity),
        costUsd: num(leg.costUsd),
        proceedsUsd: num(leg.proceedsUsd),
      });
    }
  }
  return tradeSplits;
}

export function transinfoCells(row: TransInfoExportRow): string[] {
  return [
    row.symbol,
    row.quantity,
    row.own,
    row.buyDate,
    row.buyPrice,
    row.buyTotal,
    row.buyFee,
    row.sellDate,
    row.sellPrice,
    row.sellFee,
    row.sellTotal,
    row.pnl,
    row.kind,
    row.note,
    row.tradeId,
  ];
}

export function accountCells(row: AccountExportRow): string[] {
  return [row.date, row.detail, row.own, row.hkd, row.fx, row.usd, row.inOut];
}

export function memberCells(row: MemberExportRow): string[] {
  return [row.name];
}

export function allocationCells(row: AllocationExportRow): string[] {
  return [row.effectiveOn, row.memberName, row.percent];
}

export function tradeSplitCells(row: TradeSplitExportRow): string[] {
  return [
    row.tradeId,
    row.occurredOn,
    row.symbol,
    row.side,
    row.memberName,
    row.quantity,
    row.costUsd,
    row.proceedsUsd,
  ];
}
