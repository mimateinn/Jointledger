import { money, moneyString } from "@/ledger/money";
import { MEMBER_HEY } from "./canon";
import { cell } from "./columns";
import {
  ACCOUNT_OWN,
  classifyTransInfoBook,
  membersForBook,
  normalizeOwn,
  ownAccountLabel,
} from "./own";
import type {
  ColumnMap,
  ColumnMapResult,
  ImportIssue,
  ImportPlan,
  ParsedSheet,
  PlannedCashFlow,
  PlannedTrade,
} from "./types";
import { absMoney, extractTickers, parseDate, parseInOut, parseMoney } from "./values";

function issueId(prefix: string, row: number, extra = ""): string {
  return `${prefix}-${row}${extra ? `-${extra}` : ""}`;
}

function looksLikeAllocation(detail: string): boolean {
  const text = detail.toLowerCase();
  return text.includes("%") || text.includes("分配") || text.includes("allocation");
}

export function buildPlan(
  filename: string,
  fileHash: string,
  transinfo: ParsedSheet,
  account: ParsedSheet,
  mapping: ColumnMapResult,
): ImportPlan {
  const issues: ImportIssue[] = mapping.issues.map((item, index) => ({
    id: `map-${index}`,
    sheet: item.sheet,
    row: 0,
    kind: item.kind,
    message: item.message,
    pending: false,
  }));

  const cashFlows: PlannedCashFlow[] = [];
  const trades: PlannedTrade[] = [];

  if (mapping.blocking) {
    return finish(filename, fileHash, cashFlows, trades, issues, true);
  }

  const adSymbols = new Map<string, { row: number; own: string; date: string | null }[]>();
  for (const [index, row] of account.rows.entries()) {
    const excelRow = index + 2;
    const detail = cell(row, mapping.account, "detail");
    const date = parseDate(cell(row, mapping.account, "date"));
    const own = normalizeOwn(cell(row, mapping.account, "own"));
    for (const ticker of extractTickers(detail)) {
      const list = adSymbols.get(ticker) ?? [];
      list.push({ row: excelRow, own, date });
      adSymbols.set(ticker, list);
    }
    planAccountRow(row, excelRow, mapping.account, issues, cashFlows);
  }

  const tiSymbols = new Set<string>();
  for (const [index, row] of transinfo.rows.entries()) {
    const excelRow = index + 2;
    const planned = planTransInfoRow(row, excelRow, mapping.transinfo, issues, adSymbols);
    if (planned) {
      trades.push(planned);
      tiSymbols.add(planned.symbol.toUpperCase());
    }
  }

  for (const [symbol, hits] of adSymbols) {
    if (tiSymbols.has(symbol)) {
      continue;
    }
    const first = hits[0];
    issues.push({
      id: issueId("mismatch-ad", first.row, symbol),
      sheet: "account",
      row: first.row,
      symbol,
      own: first.own,
      kind: "mismatch",
      message: `${symbol} 只喺 Account Detail，TransInfo 無對應買賣。待確認。`,
      pending: true,
    });
  }
  for (const trade of trades) {
    if (adSymbols.has(trade.symbol.toUpperCase())) {
      continue;
    }
    const id = issueId("mismatch-ti", trade.row, trade.symbol);
    issues.push({
      id,
      sheet: "transinfo",
      row: trade.row,
      symbol: trade.symbol,
      own: trade.own,
      kind: "mismatch",
      message: `${trade.symbol} 只喺 TransInfo，Account Detail 無對應。待確認。`,
      pending: true,
    });
    trade.pending = true;
    trade.warningIds.push(id);
  }

  flagSameDayJointMismatch(trades, issues);
  return finish(filename, fileHash, cashFlows, trades, issues, false);
}

function planAccountRow(
  row: string[],
  excelRow: number,
  map: ColumnMap,
  issues: ImportIssue[],
  cashFlows: PlannedCashFlow[],
): void {
  const ownRaw = cell(row, map, "own");
  const dateRaw = cell(row, map, "date");
  const detail = cell(row, map, "detail");
  const date = parseDate(dateRaw);
  if (looksLikeAllocation(detail)) {
    return;
  }
  if (!ownRaw && !dateRaw && !cell(row, map, "hkd") && !cell(row, map, "usd")) {
    return;
  }
  if (!date) {
    issues.push({
      id: issueId("ad-date", excelRow),
      sheet: "account",
      row: excelRow,
      kind: "missing_date",
      message: `Account Detail 第 ${excelRow} 行缺日期，已略過。`,
      pending: false,
    });
    return;
  }
  const own = normalizeOwn(ownRaw);
  const mapped = ACCOUNT_OWN[own];
  if (!mapped) {
    issues.push({
      id: issueId("ad-own", excelRow),
      sheet: "account",
      row: excelRow,
      own,
      kind: "unknown_own",
      message: `Account Detail 第 ${excelRow} 行 Own「${ownRaw}」唔識，無開幽靈成員，已略過。`,
      pending: false,
    });
    return;
  }
  if (mapped.role === "trade") {
    return;
  }
  const hkdRaw = parseMoney(cell(row, map, "hkd"));
  const usdRaw = parseMoney(cell(row, map, "usd"));
  const fxRaw = parseMoney(cell(row, map, "fx"));
  if (!fxRaw) {
    issues.push({
      id: issueId("ad-fx", excelRow),
      sheet: "account",
      row: excelRow,
      own,
      kind: "missing_fx",
      message: `Account Detail 第 ${excelRow} 行缺匯率，已略過，無填 0。`,
      pending: false,
    });
    return;
  }
  if (!hkdRaw && !usdRaw) {
    issues.push({
      id: issueId("ad-amt", excelRow),
      sheet: "account",
      row: excelRow,
      own,
      kind: "missing_amount",
      message: `Account Detail 第 ${excelRow} 行缺金額，已略過，無填 0。`,
      pending: false,
    });
    return;
  }

  let hkdOut: string;
  if (hkdRaw) {
    hkdOut = absMoney(hkdRaw);
  } else {
    hkdOut = moneyString(money(absMoney(usdRaw!)).mul(money(absMoney(fxRaw))));
  }

  cashFlows.push({
    id: issueId("cf", excelRow),
    row: excelRow,
    own,
    book: mapped.book,
    memberName: mapped.memberName,
    kind: parseInOut(cell(row, map, "in_out"), hkdRaw ?? usdRaw),
    amountHkd: hkdOut,
    fxRate: absMoney(fxRaw),
    occurredOn: date,
    detail,
    skip: false,
    warningIds: [],
  });
}

function planTransInfoRow(
  row: string[],
  excelRow: number,
  map: ColumnMap,
  issues: ImportIssue[],
  adSymbols: Map<string, { row: number; own: string; date: string | null }[]>,
): PlannedTrade | null {
  const symbol = cell(row, map, "symbol").trim();
  const ownRaw = cell(row, map, "own");
  const qtyRaw = cell(row, map, "quantity");
  const dateRaw = cell(row, map, "buy_date");
  if (!symbol && !ownRaw && !qtyRaw && !dateRaw) {
    return null;
  }
  const buyDate = parseDate(dateRaw);
  if (!buyDate) {
    issues.push({
      id: issueId("ti-date", excelRow),
      sheet: "transinfo",
      row: excelRow,
      symbol: symbol || undefined,
      kind: "missing_date",
      message: `TransInfo 第 ${excelRow} 行缺買入日期，已略過。`,
      pending: false,
    });
    return null;
  }
  const quantity = parseMoney(qtyRaw);
  if (!quantity) {
    issues.push({
      id: issueId("ti-qty", excelRow),
      sheet: "transinfo",
      row: excelRow,
      symbol: symbol || undefined,
      kind: "missing_qty",
      message: `TransInfo 第 ${excelRow} 行缺數量，已略過，無填 0。`,
      pending: false,
    });
    return null;
  }
  if (!symbol) {
    issues.push({
      id: issueId("ti-sym", excelRow),
      sheet: "transinfo",
      row: excelRow,
      kind: "missing_qty",
      message: `TransInfo 第 ${excelRow} 行缺代碼，已略過。`,
      pending: false,
    });
    return null;
  }

  const own = normalizeOwn(ownRaw);
  let book = classifyTransInfoBook(own, buyDate);
  if (!book) {
    issues.push({
      id: issueId("ti-own", excelRow),
      sheet: "transinfo",
      row: excelRow,
      symbol,
      own,
      kind: "unknown_own",
      message: `TransInfo 第 ${excelRow} 行 Own「${ownRaw}」唔識，無開幽靈成員，已略過。`,
      pending: false,
    });
    return null;
  }

  const adHits = (adSymbols.get(symbol.toUpperCase()) ?? []).filter(
    (hit) => !hit.date || hit.date === buyDate,
  );
  const adOwns = new Set(adHits.map((hit) => hit.own));
  if (adOwns.has("F") && book !== "joint") {
    const id = issueId("joint", excelRow, symbol);
    issues.push({
      id,
      sheet: "transinfo",
      row: excelRow,
      symbol,
      own,
      kind: "joint_mismatch",
      message: `${symbol} ${buyDate} Account Detail 係 F 聯名，唔會當 Hey 獨倉。待確認。`,
      pending: true,
    });
    book = "joint";
  }

  const buyTotal = parseMoney(cell(row, map, "buy_total"));
  const buyPrice = parseMoney(cell(row, map, "buy_price"));
  if (!buyTotal && !buyPrice) {
    issues.push({
      id: issueId("ti-px", excelRow),
      sheet: "transinfo",
      row: excelRow,
      symbol,
      kind: "missing_amount",
      message: `TransInfo 第 ${excelRow} 行缺買入總額／買入價，已略過。`,
      pending: false,
    });
    return null;
  }

  const sellDateRaw = cell(row, map, "sell_date");
  const sellDate = sellDateRaw ? parseDate(sellDateRaw) : null;
  const warningIds: string[] = [];
  let pending = false;

  if (!sellDate) {
    const id = issueId("open", excelRow, symbol);
    issues.push({
      id,
      sheet: "transinfo",
      row: excelRow,
      symbol,
      own,
      kind: "open_lot",
      message: `${symbol} ${buyDate} 賣出日空白，按表維持開倉。`,
      pending: false,
    });
    warningIds.push(id);
  }

  const cost = buyTotal ?? moneyString(money(quantity).mul(money(buyPrice!)));

  return {
    id: issueId("tr", excelRow),
    row: excelRow,
    symbol,
    own,
    book,
    quantity,
    buyDate,
    buyPrice: buyPrice ?? cost,
    buyTotal: cost,
    sellDate,
    sellPrice: parseMoney(cell(row, map, "sell_price")),
    sellFee: parseMoney(cell(row, map, "sell_fee")),
    sellTotal: parseMoney(cell(row, map, "sell_total")),
    sheetPnl: parseMoney(cell(row, map, "pnl")),
    skip: false,
    pending,
    warningIds,
  };
}

function flagSameDayJointMismatch(trades: PlannedTrade[], issues: ImportIssue[]): void {
  const groups = new Map<string, PlannedTrade[]>();
  for (const trade of trades) {
    const key = `${trade.buyDate}|${trade.symbol.toUpperCase()}`;
    const list = groups.get(key) ?? [];
    list.push(trade);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    const books = new Set(group.map((item) => item.book));
    if (books.has("joint") && books.has("hey")) {
      for (const trade of group) {
        if (trade.book === "hey") {
          const id = issueId("joint-day", trade.row, trade.symbol);
          issues.push({
            id,
            sheet: "transinfo",
            row: trade.row,
            symbol: trade.symbol,
            own: trade.own,
            kind: "joint_mismatch",
            message: `${trade.symbol} ${trade.buyDate} 同日有聯名同獨倉紀錄，唔會當 Hey 獨倉。待確認。`,
            pending: true,
          });
          trade.book = "joint";
          trade.pending = true;
          trade.warningIds.push(id);
        }
      }
    }
  }
}

function finish(
  filename: string,
  fileHash: string,
  cashFlows: PlannedCashFlow[],
  trades: PlannedTrade[],
  issues: ImportIssue[],
  blocking: boolean,
): ImportPlan {
  const members = new Set<string>();
  for (const row of cashFlows) {
    if (!row.skip) {
      members.add(row.memberName);
    }
  }
  for (const row of trades) {
    if (!row.skip) {
      for (const name of membersForBook(row.book)) {
        members.add(name);
      }
    }
  }
  if (members.size === 0) {
    members.add(MEMBER_HEY);
  }

  const skippedKinds = new Set(["missing_fx", "missing_date", "missing_qty", "missing_amount", "unknown_own"]);
  const mapKinds = new Set(["unmapped_column", "column_collision", "missing_required"]);

  return {
    filename,
    fileHash,
    members: [...members],
    ownMapping: [
      { own: "H", account: ownAccountLabel("H", "hey") },
      { own: "S", account: ownAccountLabel("S", "sze") },
      { own: "W", account: ownAccountLabel("W", "wah") },
      { own: "B", account: ownAccountLabel("B", "hey") },
      { own: "F", account: ownAccountLabel("F", "joint") },
      { own: "D", account: ownAccountLabel("D", "wah") },
      { own: "A", account: ownAccountLabel("A", "sze") },
    ],
    cashFlows,
    trades,
    issues,
    blocking,
    counts: {
      members: members.size,
      cashFlows: cashFlows.filter((row) => !row.skip).length,
      trades: trades.filter((row) => !row.skip).length,
      warnings: issues.filter((item) => !item.pending && !mapKinds.has(item.kind) && !skippedKinds.has(item.kind))
        .length,
      skipped: issues.filter((item) => skippedKinds.has(item.kind)).length,
      pending: issues.filter((item) => item.pending).length,
    },
  };
}
