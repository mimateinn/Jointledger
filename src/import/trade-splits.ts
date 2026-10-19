import { money } from "@/ledger/money";
import { headerIndex } from "./columns";
import { issueId } from "./issue-id";
import { resolveHolder } from "./own";
import type { ImportIssue, ParsedSheet, PlannedTrade } from "./types";
import { parseDate, parseMoney } from "./values";

export type TradeSplitRow = {
  excelRow: number;
  tradeId: string;
  occurredOn: string;
  symbol: string;
  side: string;
  memberName: string;
  quantity: string;
  costUsd: string;
  proceedsUsd: string;
};

export function parseTradeSplitsSheet(
  sheet: ParsedSheet | undefined,
  issues: ImportIssue[],
): TradeSplitRow[] {
  if (!sheet) {
    return [];
  }
  const tradeIdIndex = headerIndex(sheet.headers, ["tradeid", "id", "rowref", "編號"]);
  const dateIndex = headerIndex(sheet.headers, ["date", "occurredon", "buydate", "日期"]);
  const symbolIndex = headerIndex(sheet.headers, ["symbol", "code", "ticker", "股票代碼", "代碼"]);
  const sideIndex = headerIndex(sheet.headers, ["side", "kind", "種類"]);
  const memberIndex = headerIndex(sheet.headers, ["member", "name", "holder", "成員", "姓名"]);
  const qtyIndex = headerIndex(sheet.headers, ["quantity", "qty", "數量"]);
  const costIndex = headerIndex(sheet.headers, ["cost", "costusd", "買入總額"]);
  const proceedsIndex = headerIndex(sheet.headers, ["proceeds", "proceedsusd", "賣出總額"]);
  if (tradeIdIndex < 0 || memberIndex < 0 || qtyIndex < 0) {
    issues.push({
      id: "ts-headers",
      sheet: "tradesplits",
      row: 0,
      kind: "tradesplit_invalid",
      message: "TradeSplits 表頭缺必要欄（TradeId / Member / Quantity）。",
      pending: false,
    });
    return [];
  }

  const rows: TradeSplitRow[] = [];
  for (const [index, row] of sheet.rows.entries()) {
    const excelRow = index + 2;
    const tradeId = (row[tradeIdIndex] ?? "").trim();
    const memberName = (row[memberIndex] ?? "").trim();
    const qtyRaw = (row[qtyIndex] ?? "").trim();
    if (!tradeId && !memberName && !qtyRaw) {
      continue;
    }
    const quantity = parseMoney(qtyRaw);
    if (!tradeId || !memberName || quantity == null) {
      issues.push({
        id: issueId("ts-row", excelRow),
        sheet: "tradesplits",
        row: excelRow,
        kind: "tradesplit_invalid",
        message: `TradeSplits 第 ${excelRow} 行缺 TradeId／成員／數量。`,
        pending: false,
      });
      continue;
    }
    rows.push({
      excelRow,
      tradeId,
      occurredOn: dateIndex >= 0 ? parseDate((row[dateIndex] ?? "").trim()) ?? "" : "",
      symbol: symbolIndex >= 0 ? (row[symbolIndex] ?? "").trim().toUpperCase() : "",
      side: (sideIndex >= 0 ? row[sideIndex] : "buy")?.trim().toLowerCase() || "buy",
      memberName,
      quantity,
      costUsd: parseMoney(costIndex >= 0 ? row[costIndex] : "") ?? "0",
      proceedsUsd: parseMoney(proceedsIndex >= 0 ? row[proceedsIndex] : "") ?? "0",
    });
  }
  return rows;
}

export function attachCustomTradeSplits(
  trades: PlannedTrade[],
  sheet: ParsedSheet | undefined,
  issues: ImportIssue[],
  knownMembers: readonly string[],
): void {
  const rows = parseTradeSplitsSheet(sheet, issues);
  if (rows.length === 0) {
    return;
  }

  const groups = new Map<string, TradeSplitRow[]>();
  for (const row of rows) {
    const list = groups.get(row.tradeId) ?? [];
    list.push(row);
    groups.set(row.tradeId, list);
  }

  const byExportId = new Map<string, PlannedTrade>();
  for (const trade of trades) {
    if (trade.exportId) {
      byExportId.set(trade.exportId, trade);
    }
  }

  for (const [tradeId, legs] of groups) {
    const first = legs[0]!;
    let membersOk = true;
    const resolvedNames: string[] = [];
    for (const leg of legs) {
      const resolved = resolveHolder(leg.memberName, knownMembers);
      if (!resolved.ok || resolved.holder.book === "joint" || !resolved.holder.memberName.trim()) {
        issues.push({
          id: issueId("ts-own", leg.excelRow, leg.memberName),
          sheet: "tradesplits",
          row: leg.excelRow,
          kind: "unknown_member",
          message: `TradeSplits 第 ${leg.excelRow} 行成員「${leg.memberName}」唔對應任何成員。`,
          pending: false,
        });
        membersOk = false;
        resolvedNames.push(leg.memberName);
      } else {
        resolvedNames.push(resolved.holder.memberName);
      }
    }

    const trade = byExportId.get(tradeId);
    if (!trade || trade.holderError) {
      issues.push({
        id: issueId("ts-id", first.excelRow, tradeId),
        sheet: "tradesplits",
        row: first.excelRow,
        kind: "tradesplit_invalid",
        message: `TradeSplits 第 ${first.excelRow} 行 TradeId「${tradeId}」對唔上任何買賣。`,
        pending: false,
      });
      continue;
    }
    if (trade.book !== "joint") {
      issues.push({
        id: issueId("ts-personal", first.excelRow, tradeId),
        sheet: "tradesplits",
        row: first.excelRow,
        kind: "tradesplit_invalid",
        message: `TradeSplits 第 ${first.excelRow} 行 TradeId「${tradeId}」唔係聯名買賣。`,
        pending: false,
      });
      continue;
    }

    const qtySum = legs.reduce((sum, leg) => sum.plus(money(leg.quantity)), money("0"));
    if (!qtySum.eq(money(trade.quantity || "0"))) {
      issues.push({
        id: issueId("ts-sum", first.excelRow, tradeId),
        sheet: "tradesplits",
        row: first.excelRow,
        kind: "tradesplit_invalid",
        message: `TradeSplits 第 ${first.excelRow} 行分帳數量加唔返買賣數量（第 ${trade.row} 行）。`,
        pending: false,
      });
      continue;
    }

    const hasMoney = legs.some((leg) => money(leg.costUsd).gt(0) || money(leg.proceedsUsd).gt(0));
    const moneyField =
      trade.side === "sell" ||
      trade.side === "adjustment" ||
      legs.some((leg) => money(leg.proceedsUsd).gt(0))
        ? "proceedsUsd"
        : "costUsd";
    const amountSum = legs.reduce((sum, leg) => sum.plus(money(leg[moneyField])), money("0"));
    let expectedAmount = trade.buyTotal || "0";
    if (trade.side === "sell") {
      expectedAmount = trade.sellTotal ?? trade.buyTotal ?? "0";
    } else if (trade.side === "adjustment") {
      try {
        expectedAmount = money(trade.buyTotal || "0").abs().toString();
      } catch {
        expectedAmount = trade.buyTotal || "0";
      }
    }
    const feeRaw = trade.side === "sell" ? trade.sellFee : trade.buyFee;
    let expectedFee = "0";
    try {
      expectedFee = feeRaw && feeRaw.trim() ? money(feeRaw).abs().toString() : "0";
    } catch {
      expectedFee = "0";
    }
    const amountOk = amountSum.minus(money(expectedAmount || "0")).abs().lte("0.01");
    const amountPlusFeeOk = amountSum.minus(money(expectedAmount || "0").plus(money(expectedFee))).abs().lte("0.01");
    if (hasMoney && !amountOk && !amountPlusFeeOk) {
      issues.push({
        id: issueId("ts-amt", first.excelRow, tradeId),
        sheet: "tradesplits",
        row: first.excelRow,
        kind: "tradesplit_invalid",
        message: `TradeSplits 第 ${first.excelRow} 行分帳金額加唔返買賣／股息金額（第 ${trade.row} 行）。`,
        pending: false,
      });
      continue;
    }

    if (!membersOk) {
      continue;
    }
    trade.customLegs = legs.map((leg, index) => ({
      memberName: resolvedNames[index] ?? leg.memberName,
      quantity: leg.quantity,
      costUsd: leg.costUsd,
      proceedsUsd: leg.proceedsUsd,
    }));
  }
}
