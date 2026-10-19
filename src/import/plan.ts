import { money, moneyString } from "@/ledger/money";
import { MEMBER_HEY, MEMBER_SZE, MEMBER_WAH, normalizeScheduleLegs } from "./canon";
import { cell, normalizeHeader } from "./columns";
import { membersForBook, normalizeOwn, ownAccountLabel, resolveHolder } from "./own";
import type {
  ColumnMap,
  ColumnMapResult,
  ImportExtras,
  ImportIssue,
  ImportPlan,
  ParsedSheet,
  PlannedAllocationSchedule,
  PlannedCashFlow,
  PlannedTrade,
} from "./types";
import { dividendNote } from "@/ledger/dividend";
import { isDividendKindRaw, parseRowKind } from "./row-kind";
import { absMoney, extractTickers, parseDate, parseInOut, parseMoney } from "./values";

function issueId(prefix: string, row: number, extra = ""): string {
  return `${prefix}-${row}${extra ? `-${extra}` : ""}`;
}

function looksLikeAllocation(detail: string): boolean {
  const text = detail.toLowerCase();
  return text.includes("%") || text.includes("分配") || text.includes("allocation");
}

function unknownHolderIssue(
  sheet: "transinfo" | "account",
  excelRow: number,
  ownRaw: string,
  symbol?: string,
): ImportIssue {
  return {
    id: issueId(sheet === "transinfo" ? "ti-own" : "ad-own", excelRow, symbol || "row"),
    sheet,
    row: excelRow,
    symbol,
    own: ownRaw,
    kind: "unknown_member",
    message: `${sheet === "transinfo" ? "TransInfo" : "Account Detail"} 第 ${excelRow} 行 holder「${ownRaw}」唔對應任何成員。`,
    pending: false,
  };
}

function parseMembersSheet(sheet: ParsedSheet | undefined): string[] {
  if (!sheet) {
    return [];
  }
  const nameIndex = sheet.headers.findIndex((header) => {
    const key = normalizeHeader(header);
    return key === "name" || key === "member" || key === "displayname" || key === "成員" || key === "姓名";
  });
  const index = nameIndex >= 0 ? nameIndex : 0;
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of sheet.rows) {
    const name = (row[index] ?? "").trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return names;
}

function headerIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function parseAllocationSheet(sheet: ParsedSheet | undefined): PlannedAllocationSchedule[] {
  if (!sheet) {
    return [];
  }
  const dateIndex = headerIndex(sheet.headers, ["effectivedate", "effectiveon", "date", "生效日", "日期"]);
  const memberIndex = headerIndex(sheet.headers, ["member", "name", "holder", "成員", "姓名"]);
  const percentIndex = headerIndex(sheet.headers, ["percent", "percentage", "ratio", "share", "比例", "百分比"]);
  if (dateIndex < 0 || memberIndex < 0 || percentIndex < 0) {
    return [];
  }
  const groups = new Map<string, { name: string; raw: string }[]>();
  for (const row of sheet.rows) {
    const date = parseDate((row[dateIndex] ?? "").trim());
    const name = (row[memberIndex] ?? "").trim();
    const raw = (row[percentIndex] ?? "").trim();
    if (!date || !name || !raw) {
      continue;
    }
    const list = groups.get(date) ?? [];
    list.push({ name, raw });
    groups.set(date, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([effectiveOn, legs]) => ({
      effectiveOn,
      legs: normalizeScheduleLegs(legs).map((leg) => ({
        memberName: leg.name,
        percent: leg.percent,
      })),
    }));
}

export function buildPlan(
  filename: string,
  fileHash: string,
  transinfo: ParsedSheet,
  account: ParsedSheet,
  mapping: ColumnMapResult,
  extras: ImportExtras = {},
): ImportPlan {
  const issues: ImportIssue[] = mapping.issues.map((item, index) => ({
    id: `map-${index}`,
    sheet: item.sheet,
    row: 0,
    kind: item.kind,
    message: item.message,
    pending: false,
  }));

  const listedMembers = parseMembersSheet(extras.members);
  const schedules = parseAllocationSheet(extras.allocation);
  const knownMembers = [
    ...new Set([
      MEMBER_HEY,
      MEMBER_SZE,
      MEMBER_WAH,
      ...listedMembers,
      ...schedules.flatMap((schedule) => schedule.legs.map((leg) => leg.memberName)),
    ]),
  ];

  const cashFlows: PlannedCashFlow[] = [];
  const trades: PlannedTrade[] = [];

  if (mapping.blocking) {
    return finish(filename, fileHash, cashFlows, trades, issues, true, listedMembers, schedules);
  }

  const adSymbols = new Map<string, { row: number; own: string; date: string | null }[]>();
  for (const [index, row] of account.rows.entries()) {
    const excelRow = index + 2;
    const detail = cell(row, mapping.account, "detail");
    const date = parseDate(cell(row, mapping.account, "date"));
    const ownRaw = cell(row, mapping.account, "own");
    const resolved = resolveHolder(ownRaw, knownMembers);
    const own = resolved?.own ?? normalizeOwn(ownRaw);
    for (const ticker of extractTickers(detail)) {
      const list = adSymbols.get(ticker) ?? [];
      list.push({ row: excelRow, own, date });
      adSymbols.set(ticker, list);
    }
    planAccountRow(row, excelRow, mapping.account, issues, cashFlows, knownMembers);
  }

  const tiSymbols = new Set<string>();
  for (const [index, row] of transinfo.rows.entries()) {
    const excelRow = index + 2;
    const planned = planTransInfoRow(row, excelRow, mapping.transinfo, issues, adSymbols, knownMembers);
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
  const blocking = issues.some((item) => item.kind === "unknown_member");
  return finish(filename, fileHash, cashFlows, trades, issues, blocking, listedMembers, schedules);
}

function planAccountRow(
  row: string[],
  excelRow: number,
  map: ColumnMap,
  issues: ImportIssue[],
  cashFlows: PlannedCashFlow[],
  knownMembers: readonly string[],
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
  const resolved = resolveHolder(ownRaw, knownMembers);
  if (!resolved) {
    issues.push(unknownHolderIssue("account", excelRow, ownRaw));
    return;
  }
  if (resolved.role === "trade") {
    return;
  }
  const hkdRaw = parseMoney(cell(row, map, "hkd"));
  const usdRaw = parseMoney(cell(row, map, "usd"));
  const fxRaw = parseMoney(cell(row, map, "fx"));
  if (!hkdRaw && !usdRaw && !fxRaw) {
    return;
  }
  if (!fxRaw) {
    issues.push({
      id: issueId("ad-fx", excelRow),
      sheet: "account",
      row: excelRow,
      own: resolved.own,
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
      own: resolved.own,
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
    own: resolved.own,
    book: resolved.book,
    memberName: resolved.memberName,
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
  knownMembers: readonly string[],
): PlannedTrade | null {
  const symbol = cell(row, map, "symbol").trim();
  const ownRaw = cell(row, map, "own");
  const qtyRaw = cell(row, map, "quantity");
  const dateRaw = cell(row, map, "buy_date");
  if (!symbol && !ownRaw && !qtyRaw && !dateRaw) {
    return null;
  }
  const kindRaw = cell(row, map, "row_kind");
  const rowKind = parseRowKind(kindRaw);
  const noteRaw = cell(row, map, "note");
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
  if (rowKind === "split") {
    return planSplitRow(row, excelRow, map, issues, symbol, ownRaw, buyDate, knownMembers, noteRaw);
  }
  if (rowKind === "adjustment") {
    return planAdjustmentRow(row, excelRow, map, issues, symbol, ownRaw, buyDate, kindRaw, knownMembers, noteRaw);
  }
  if (rowKind === "sell") {
    return planSellRow(row, excelRow, map, issues, symbol, ownRaw, buyDate, knownMembers, noteRaw);
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

  const resolved = resolveImportHolder(excelRow, symbol, ownRaw, issues, knownMembers);
  if (!resolved) {
    return null;
  }
  let book = resolved.book;
  const own = resolved.own;

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
  const pending = false;

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
    memberName: resolved.memberName,
    quantity,
    buyDate,
    buyPrice: buyPrice ?? cost,
    buyTotal: cost,
    sellDate,
    sellPrice: parseMoney(cell(row, map, "sell_price")),
    sellFee: parseMoney(cell(row, map, "sell_fee")),
    sellTotal: parseMoney(cell(row, map, "sell_total")),
    sheetPnl: parseMoney(cell(row, map, "pnl")),
    side: "buy",
    note: noteRaw.trim() ? noteRaw.trim() : null,
    skip: false,
    pending,
    warningIds,
  };
}

function resolveImportHolder(
  excelRow: number,
  symbol: string,
  ownRaw: string,
  issues: ImportIssue[],
  knownMembers: readonly string[],
): { own: string; book: NonNullable<ReturnType<typeof resolveHolder>>["book"]; memberName: string } | null {
  const resolved = resolveHolder(ownRaw, knownMembers);
  if (!resolved) {
    issues.push(unknownHolderIssue("transinfo", excelRow, ownRaw, symbol || undefined));
    return null;
  }
  return { own: resolved.own, book: resolved.book, memberName: resolved.memberName };
}

function planSplitRow(
  row: string[],
  excelRow: number,
  map: ColumnMap,
  issues: ImportIssue[],
  symbol: string,
  ownRaw: string,
  buyDate: string,
  knownMembers: readonly string[],
  noteRaw: string,
): PlannedTrade | null {
  if (!symbol) {
    issues.push({
      id: issueId("ti-sym", excelRow),
      sheet: "transinfo",
      row: excelRow,
      kind: "missing_qty",
      message: `TransInfo 第 ${excelRow} 行拆股缺代碼，已略過。`,
      pending: false,
    });
    return null;
  }
  const newShares = parseMoney(cell(row, map, "quantity"));
  const oldShares = parseMoney(cell(row, map, "buy_price"));
  if (!newShares) {
    issues.push({
      id: issueId("ti-qty", excelRow),
      sheet: "transinfo",
      row: excelRow,
      symbol,
      kind: "missing_qty",
      message: `TransInfo 第 ${excelRow} 行拆股缺新股數量，已略過。`,
      pending: false,
    });
    return null;
  }
  if (!oldShares) {
    issues.push({
      id: issueId("ti-px", excelRow),
      sheet: "transinfo",
      row: excelRow,
      symbol,
      kind: "missing_amount",
      message: `TransInfo 第 ${excelRow} 行拆股缺舊股（買入價欄），已略過。`,
      pending: false,
    });
    return null;
  }
  const resolved = resolveImportHolder(excelRow, symbol, ownRaw, issues, knownMembers);
  if (!resolved) {
    return null;
  }
  return {
    id: issueId("tr", excelRow),
    row: excelRow,
    symbol,
    own: resolved.own,
    book: resolved.book,
    memberName: resolved.memberName,
    quantity: newShares,
    buyDate,
    buyPrice: oldShares,
    buyTotal: "0",
    sellDate: null,
    sellPrice: null,
    sellFee: null,
    sellTotal: null,
    sheetPnl: null,
    side: "split",
    note: noteRaw.trim() ? noteRaw.trim() : `拆股 ${newShares}:${oldShares}`,
    skip: false,
    pending: false,
    warningIds: [],
  };
}

function planAdjustmentRow(
  row: string[],
  excelRow: number,
  map: ColumnMap,
  issues: ImportIssue[],
  symbol: string,
  ownRaw: string,
  buyDate: string,
  kindRaw = "",
  knownMembers: readonly string[] = [],
  noteRaw = "",
): PlannedTrade | null {
  const amount = parseMoney(cell(row, map, "buy_total")) ?? parseMoney(cell(row, map, "buy_price"));
  const resolved = resolveImportHolder(excelRow, symbol || "—", ownRaw, issues, knownMembers);
  if (!resolved) {
    return null;
  }
  const fallbackNote = isDividendKindRaw(kindRaw)
    ? dividendNote(symbol && symbol !== "—" ? symbol : "")
    : symbol
      ? `匯入調整 ${symbol}`
      : "匯入調整";
  return {
    id: issueId("tr", excelRow),
    row: excelRow,
    symbol: symbol || "—",
    own: resolved.own,
    book: resolved.book,
    memberName: resolved.memberName,
    quantity: parseMoney(cell(row, map, "quantity")) ?? "0",
    buyDate,
    buyPrice: amount ?? "0",
    buyTotal: amount ?? "0",
    sellDate: null,
    sellPrice: null,
    sellFee: null,
    sellTotal: null,
    sheetPnl: null,
    side: "adjustment",
    note: noteRaw.trim() ? noteRaw.trim() : fallbackNote,
    skip: false,
    pending: false,
    warningIds: [],
  };
}

function planSellRow(
  row: string[],
  excelRow: number,
  map: ColumnMap,
  issues: ImportIssue[],
  symbol: string,
  ownRaw: string,
  buyDate: string,
  knownMembers: readonly string[],
  noteRaw: string,
): PlannedTrade | null {
  if (!symbol) {
    issues.push({
      id: issueId("ti-sym", excelRow),
      sheet: "transinfo",
      row: excelRow,
      kind: "missing_qty",
      message: `TransInfo 第 ${excelRow} 行賣出缺代碼，已略過。`,
      pending: false,
    });
    return null;
  }
  const quantity = parseMoney(cell(row, map, "quantity"));
  if (!quantity) {
    issues.push({
      id: issueId("ti-qty", excelRow),
      sheet: "transinfo",
      row: excelRow,
      symbol,
      kind: "missing_qty",
      message: `TransInfo 第 ${excelRow} 行賣出缺數量，已略過，無填 0。`,
      pending: false,
    });
    return null;
  }
  const resolved = resolveImportHolder(excelRow, symbol, ownRaw, issues, knownMembers);
  if (!resolved) {
    return null;
  }
  const sellDate = parseDate(cell(row, map, "sell_date")) ?? buyDate;
  const sellPrice = parseMoney(cell(row, map, "sell_price")) ?? parseMoney(cell(row, map, "buy_price"));
  const sellTotal =
    parseMoney(cell(row, map, "sell_total")) ?? parseMoney(cell(row, map, "buy_total"));
  if (!sellPrice && !sellTotal) {
    issues.push({
      id: issueId("ti-px", excelRow),
      sheet: "transinfo",
      row: excelRow,
      symbol,
      kind: "missing_amount",
      message: `TransInfo 第 ${excelRow} 行賣出缺賣出價／總額，已略過。`,
      pending: false,
    });
    return null;
  }
  const proceeds = sellTotal ?? moneyString(money(quantity).mul(money(sellPrice!)));
  return {
    id: issueId("tr", excelRow),
    row: excelRow,
    symbol,
    own: resolved.own,
    book: resolved.book,
    memberName: resolved.memberName,
    quantity,
    buyDate: sellDate,
    buyPrice: sellPrice ?? proceeds,
    buyTotal: proceeds,
    sellDate,
    sellPrice: sellPrice,
    sellFee: parseMoney(cell(row, map, "sell_fee")),
    sellTotal: proceeds,
    sheetPnl: parseMoney(cell(row, map, "pnl")),
    side: "sell",
    note: noteRaw.trim() ? noteRaw.trim() : null,
    skip: false,
    pending: false,
    warningIds: [],
  };
}

function flagSameDayJointMismatch(trades: PlannedTrade[], issues: ImportIssue[]): void {
  const groups = new Map<string, PlannedTrade[]>();
  for (const trade of trades) {
    if (trade.side === "split" || trade.side === "adjustment" || trade.side === "sell") {
      continue;
    }
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
  listedMembers: readonly string[] = [],
  schedules: PlannedAllocationSchedule[] = [],
): ImportPlan {
  const members = new Set<string>();
  for (const name of listedMembers) {
    if (name.trim()) {
      members.add(name.trim());
    }
  }
  for (const schedule of schedules) {
    for (const leg of schedule.legs) {
      members.add(leg.memberName);
    }
  }
  for (const row of cashFlows) {
    if (!row.skip) {
      members.add(row.memberName);
    }
  }
  for (const row of trades) {
    if (!row.skip) {
      for (const name of membersForBook(row.book, row.memberName)) {
        members.add(name);
      }
    }
  }
  if (members.size === 0) {
    members.add(MEMBER_HEY);
  }

  const skippedKinds = new Set(["missing_fx", "missing_date", "missing_qty", "missing_amount", "unknown_own"]);
  const mapKinds = new Set(["unmapped_column", "column_collision", "missing_required"]);
  const blocked = blocking || issues.some((item) => item.kind === "unknown_member");

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
    schedules,
    cashFlows,
    trades,
    issues,
    blocking: blocked,
    counts: {
      members: members.size,
      cashFlows: cashFlows.filter((row) => !row.skip).length,
      trades: trades.filter((row) => !row.skip).length,
      warnings: issues.filter((item) => !item.pending && !mapKinds.has(item.kind) && !skippedKinds.has(item.kind))
        .length,
      skipped: issues.filter((item) => skippedKinds.has(item.kind) || item.kind === "unknown_member").length,
      pending: issues.filter((item) => item.pending).length,
    },
  };
}
