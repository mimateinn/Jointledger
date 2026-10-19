import { money, moneyString } from "@/ledger/money";
import { dividendNote } from "@/ledger/dividend";
import { normalizeScheduleLegs } from "./canon";
import { cell, normalizeHeader } from "./columns";
import { membersForBook, ownAccountLabel, resolveHolder, type ResolvedHolder } from "./own";
import type {
  ColumnMap,
  ColumnMapResult,
  ImportExtras,
  ImportIssue,
  ImportPlan,
  IssueKind,
  ParsedSheet,
  PlannedAllocationSchedule,
  PlannedCashFlow,
  PlannedTrade,
} from "./types";
import { isDividendKindRaw, parseRowKind } from "./row-kind";
import { absMoney, extractTickers, parseDate, parseInOut, parseMoney } from "./values";

function issueId(prefix: string, row: number, extra = ""): string {
  return `${prefix}-${row}${extra ? `-${extra}` : ""}`;
}

function looksLikeAllocation(detail: string): boolean {
  const text = detail.toLowerCase();
  return text.includes("%") || text.includes("分配") || text.includes("allocation");
}

const HOLDER_ISSUE_KIND: Record<"empty" | "unknown" | "ambiguous", IssueKind> = {
  empty: "empty_holder",
  unknown: "unknown_member",
  ambiguous: "ambiguous_holder",
};

function holderIssue(
  sheet: "transinfo" | "account",
  excelRow: number,
  ownRaw: string,
  reason: "empty" | "unknown" | "ambiguous",
  symbol?: string,
): ImportIssue {
  const sheetName = sheet === "transinfo" ? "TransInfo" : "Account Detail";
  let message: string;
  if (reason === "empty") {
    message = `${sheetName} 第 ${excelRow} 行 holder 空白，唔可以當 Hey。`;
  } else if (reason === "ambiguous") {
    message = `${sheetName} 第 ${excelRow} 行 holder「${ownRaw}」有歧義。`;
  } else {
    message = `${sheetName} 第 ${excelRow} 行 holder「${ownRaw}」唔對應任何成員。`;
  }
  return {
    id: issueId(sheet === "transinfo" ? "ti-own" : "ad-own", excelRow, symbol || "row"),
    sheet,
    row: excelRow,
    symbol,
    own: ownRaw,
    kind: HOLDER_ISSUE_KIND[reason],
    message,
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
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

function headerIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function parsePercentRaw(raw: string): string | null {
  return parseMoney(raw.replace(/%/g, ""));
}

function parseAllocationSheet(
  sheet: ParsedSheet | undefined,
  listedMembers: readonly string[],
  issues: ImportIssue[],
): PlannedAllocationSchedule[] {
  if (!sheet) {
    return [];
  }
  const dateIndex = headerIndex(sheet.headers, ["effectivedate", "effectiveon", "date", "生效日", "日期"]);
  const memberIndex = headerIndex(sheet.headers, ["member", "name", "holder", "成員", "姓名"]);
  const percentIndex = headerIndex(sheet.headers, ["percent", "percentage", "ratio", "share", "比例", "百分比"]);
  if (dateIndex < 0 || memberIndex < 0 || percentIndex < 0) {
    issues.push({
      id: "alloc-headers",
      sheet: "allocation",
      row: 0,
      kind: "allocation_invalid",
      message: `Allocation 表頭缺必要欄（Effective Date / Member / Percent）。`,
      pending: false,
    });
    return [];
  }

  const listed = new Set(listedMembers.map((name) => name.trim().toLowerCase()));
  const groups = new Map<string, { name: string; raw: string; row: number }[]>();
  for (const [index, row] of sheet.rows.entries()) {
    const excelRow = index + 2;
    const dateRaw = (row[dateIndex] ?? "").trim();
    const name = (row[memberIndex] ?? "").trim();
    const raw = (row[percentIndex] ?? "").trim();
    if (!dateRaw && !name && !raw) {
      continue;
    }
    const date = parseDate(dateRaw);
    if (!date || !name || !raw) {
      issues.push({
        id: issueId("alloc-row", excelRow),
        sheet: "allocation",
        row: excelRow,
        kind: "allocation_invalid",
        message: `Allocation 第 ${excelRow} 行缺生效日／成員／比例。`,
        pending: false,
      });
      continue;
    }
    const percent = parsePercentRaw(raw);
    if (!percent) {
      issues.push({
        id: issueId("alloc-pct", excelRow),
        sheet: "allocation",
        row: excelRow,
        kind: "allocation_invalid",
        message: `Allocation 第 ${excelRow} 行 percent「${raw}」無效。`,
        pending: false,
      });
      continue;
    }
    try {
      if (!money(percent).gt(0)) {
        issues.push({
          id: issueId("alloc-pct", excelRow),
          sheet: "allocation",
          row: excelRow,
          kind: "allocation_invalid",
          message: `Allocation 第 ${excelRow} 行 percent「${raw}」無效。`,
          pending: false,
        });
        continue;
      }
    } catch {
      issues.push({
        id: issueId("alloc-pct", excelRow),
        sheet: "allocation",
        row: excelRow,
        kind: "allocation_invalid",
        message: `Allocation 第 ${excelRow} 行 percent「${raw}」無效。`,
        pending: false,
      });
      continue;
    }
    if (!listed.has(name.toLowerCase())) {
      issues.push({
        id: issueId("alloc-member", excelRow, name),
        sheet: "allocation",
        row: excelRow,
        kind: "allocation_invalid",
        message: `Allocation 第 ${excelRow} 行成員「${name}」唔喺 Members 表，無自動開戶。`,
        pending: false,
      });
      continue;
    }
    const list = groups.get(date) ?? [];
    list.push({ name, raw: percent, row: excelRow });
    groups.set(date, list);
  }

  const schedules: PlannedAllocationSchedule[] = [];
  for (const [effectiveOn, legs] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    try {
      schedules.push({
        effectiveOn,
        legs: normalizeScheduleLegs(legs).map((leg) => ({
          memberName: leg.name,
          percent: leg.percent,
        })),
      });
    } catch {
      const row = legs[0]?.row ?? 0;
      issues.push({
        id: issueId("alloc-sum", row),
        sheet: "allocation",
        row,
        kind: "allocation_invalid",
        message: `Allocation 第 ${row} 行 percent 無法正規化。`,
        pending: false,
      });
    }
  }
  return schedules;
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
  const schedules = parseAllocationSheet(extras.allocation, listedMembers, issues);
  const knownMembers = [...listedMembers];

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
    const own = resolved.ok ? resolved.holder.own : ownRaw.trim();
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
      if (planned.symbol) {
        tiSymbols.add(planned.symbol.toUpperCase());
      }
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
    if (trade.holderError || adSymbols.has(trade.symbol.toUpperCase())) {
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
  const blocking = issues.some((item) => isHolderOrAllocationIssue(item.kind));
  return finish(filename, fileHash, cashFlows, trades, issues, blocking, listedMembers, schedules);
}

function isHolderOrAllocationIssue(kind: IssueKind): boolean {
  return (
    kind === "unknown_member" ||
    kind === "empty_holder" ||
    kind === "ambiguous_holder" ||
    kind === "allocation_invalid"
  );
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
  const hkdRaw = parseMoney(cell(row, map, "hkd"));
  const usdRaw = parseMoney(cell(row, map, "usd"));
  const fxRaw = parseMoney(cell(row, map, "fx"));
  const resolved = resolveHolder(ownRaw, knownMembers);
  if (!resolved.ok) {
    if (!hkdRaw && !usdRaw && !fxRaw) {
      return;
    }
    issues.push(holderIssue("account", excelRow, ownRaw, resolved.reason));
    cashFlows.push(failedCashFlow(excelRow, ownRaw, date, detail, resolved.reason, hkdRaw, fxRaw));
    return;
  }
  if (resolved.holder.role === "trade") {
    return;
  }
  if (!hkdRaw && !usdRaw && !fxRaw) {
    return;
  }
  if (!fxRaw) {
    issues.push({
      id: issueId("ad-fx", excelRow),
      sheet: "account",
      row: excelRow,
      own: resolved.holder.own,
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
      own: resolved.holder.own,
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
    own: resolved.holder.own,
    book: resolved.holder.book,
    memberName: resolved.holder.memberName,
    kind: parseInOut(cell(row, map, "in_out"), hkdRaw ?? usdRaw),
    amountHkd: hkdOut,
    fxRate: absMoney(fxRaw),
    occurredOn: date,
    detail,
    skip: false,
    warningIds: [],
  });
}

function failedCashFlow(
  excelRow: number,
  ownRaw: string,
  date: string,
  detail: string,
  reason: "empty" | "unknown" | "ambiguous",
  hkdRaw: string | null,
  fxRaw: string | null,
): PlannedCashFlow {
  return {
    id: issueId("cf", excelRow),
    row: excelRow,
    own: ownRaw,
    book: "personal",
    memberName: "",
    kind: "deposit",
    amountHkd: hkdRaw ?? "0",
    fxRate: fxRaw ?? "1",
    occurredOn: date,
    detail,
    skip: false,
    warningIds: [],
    holderError: reason,
  };
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
  const sellDateRaw = cell(row, map, "sell_date");
  if (!symbol && !ownRaw && !qtyRaw && !dateRaw && !sellDateRaw) {
    return null;
  }
  const kindRaw = cell(row, map, "row_kind");
  const rowKind = parseRowKind(kindRaw);
  const noteRaw = cell(row, map, "note");
  const buyDate = parseDate(dateRaw);
  const sellDate = parseDate(sellDateRaw);

  if (rowKind === "sell") {
    const occurredOn = sellDate ?? buyDate;
    if (!occurredOn) {
      issues.push({
        id: issueId("ti-date", excelRow),
        sheet: "transinfo",
        row: excelRow,
        symbol: symbol || undefined,
        kind: "missing_date",
        message: `TransInfo 第 ${excelRow} 行缺賣出日期，已略過。`,
        pending: false,
      });
      return null;
    }
    return planSellRow(row, excelRow, map, issues, symbol, ownRaw, occurredOn, knownMembers, noteRaw);
  }

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
  if (!resolved.ok) {
    return failedTrade(excelRow, symbol, ownRaw, buyDate, resolved.reason);
  }
  let book = resolved.holder.book;
  const own = resolved.holder.own;

  const adHits = (adSymbols.get(symbol.toUpperCase()) ?? []).filter(
    (hit) => !hit.date || hit.date === buyDate,
  );
  const adHasJoint = adHits.some((hit) => {
    const adHolder = resolveHolder(hit.own, knownMembers);
    return adHolder.ok && adHolder.holder.book === "joint";
  });
  if (adHasJoint && book !== "joint") {
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

  const parsedSellDate = sellDate;
  const warningIds: string[] = [];
  const pending = false;

  if (!parsedSellDate) {
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
    memberName: resolved.holder.memberName,
    quantity,
    buyDate,
    buyPrice: buyPrice ?? cost,
    buyTotal: cost,
    buyFee: parseMoney(cell(row, map, "buy_fee")),
    sellDate: parsedSellDate,
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

function failedTrade(
  excelRow: number,
  symbol: string,
  ownRaw: string,
  buyDate: string,
  reason: "empty" | "unknown" | "ambiguous",
): PlannedTrade {
  return {
    id: issueId("tr", excelRow),
    row: excelRow,
    symbol: symbol || "—",
    own: ownRaw,
    book: "personal",
    memberName: "",
    quantity: "0",
    buyDate,
    buyPrice: "0",
    buyTotal: "0",
    buyFee: null,
    sellDate: null,
    sellPrice: null,
    sellFee: null,
    sellTotal: null,
    sheetPnl: null,
    side: "buy",
    note: null,
    skip: false,
    pending: false,
    warningIds: [],
    holderError: reason,
  };
}

function resolveImportHolder(
  excelRow: number,
  symbol: string,
  ownRaw: string,
  issues: ImportIssue[],
  knownMembers: readonly string[],
): { ok: true; holder: ResolvedHolder } | { ok: false; reason: "empty" | "unknown" | "ambiguous" } {
  const resolved = resolveHolder(ownRaw, knownMembers);
  if (!resolved.ok) {
    issues.push(holderIssue("transinfo", excelRow, ownRaw, resolved.reason, symbol || undefined));
    return resolved;
  }
  return { ok: true, holder: resolved.holder };
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
  if (!resolved.ok) {
    return failedTrade(excelRow, symbol, ownRaw, buyDate, resolved.reason);
  }
  return {
    id: issueId("tr", excelRow),
    row: excelRow,
    symbol,
    own: resolved.holder.own,
    book: resolved.holder.book,
    memberName: resolved.holder.memberName,
    quantity: newShares,
    buyDate,
    buyPrice: oldShares,
    buyTotal: "0",
    buyFee: null,
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
  if (!resolved.ok) {
    return failedTrade(excelRow, symbol || "—", ownRaw, buyDate, resolved.reason);
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
    own: resolved.holder.own,
    book: resolved.holder.book,
    memberName: resolved.holder.memberName,
    quantity: parseMoney(cell(row, map, "quantity")) ?? "0",
    buyDate,
    buyPrice: amount ?? "0",
    buyTotal: amount ?? "0",
    buyFee: null,
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
  occurredOn: string,
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
  if (!resolved.ok) {
    return failedTrade(excelRow, symbol, ownRaw, occurredOn, resolved.reason);
  }
  const sellPrice = parseMoney(cell(row, map, "sell_price")) ?? parseMoney(cell(row, map, "buy_price"));
  const sellTotal = parseMoney(cell(row, map, "sell_total")) ?? parseMoney(cell(row, map, "buy_total"));
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
    own: resolved.holder.own,
    book: resolved.holder.book,
    memberName: resolved.holder.memberName,
    quantity,
    buyDate: occurredOn,
    buyPrice: sellPrice ?? proceeds,
    buyTotal: proceeds,
    buyFee: null,
    sellDate: occurredOn,
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
    if (trade.side === "split" || trade.side === "adjustment" || trade.side === "sell" || trade.holderError) {
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
  for (const row of cashFlows) {
    if (!row.skip && !row.holderError && row.memberName.trim()) {
      members.add(row.memberName);
    }
  }
  for (const row of trades) {
    if (row.skip || row.holderError) {
      continue;
    }
    for (const name of membersForBook(row.book, row.memberName)) {
      if (name.trim()) {
        members.add(name);
      }
    }
  }

  const skippedKinds = new Set(["missing_fx", "missing_date", "missing_qty", "missing_amount", "unknown_own"]);
  const mapKinds = new Set(["unmapped_column", "column_collision", "missing_required"]);
  const blocked = blocking || issues.some((item) => isHolderOrAllocationIssue(item.kind));

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
      cashFlows: cashFlows.filter((row) => !row.skip && !row.holderError).length,
      trades: trades.filter((row) => !row.skip && !row.holderError).length,
      warnings: issues.filter((item) => !item.pending && !mapKinds.has(item.kind) && !skippedKinds.has(item.kind))
        .length,
      skipped: issues.filter(
        (item) =>
          skippedKinds.has(item.kind) ||
          item.kind === "unknown_member" ||
          item.kind === "empty_holder" ||
          item.kind === "ambiguous_holder",
      ).length,
      pending: issues.filter((item) => item.pending).length,
    },
  };
}
