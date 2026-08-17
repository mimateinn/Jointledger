import type {
  AccountTarget,
  ColumnMap,
  ColumnMapResult,
  ColumnTarget,
  MapIssue,
  ParsedSheet,
  SheetKind,
  TransInfoTarget,
} from "./types";

const TRANSINFO_ALIASES: Record<string, TransInfoTarget> = {
  code: "symbol",
  codes: "symbol",
  symbol: "symbol",
  ticker: "symbol",
  代碼: "symbol",
  代號: "symbol",
  股票: "symbol",
  股票代碼: "symbol",
  qty: "quantity",
  quantity: "quantity",
  shares: "quantity",
  數量: "quantity",
  股數: "quantity",
  own: "own",
  owner: "own",
  持有: "own",
  持倉人: "own",
  buydate: "buy_date",
  datebuy: "buy_date",
  買入日期: "buy_date",
  買入日: "buy_date",
  購入日: "buy_date",
  buyprice: "buy_price",
  買入價: "buy_price",
  買入價格: "buy_price",
  購入價: "buy_price",
  buytotal: "buy_total",
  buyamount: "buy_total",
  cost: "buy_total",
  買入總額: "buy_total",
  買入金額: "buy_total",
  成本: "buy_total",
  selldate: "sell_date",
  賣出日期: "sell_date",
  賣出日: "sell_date",
  sellprice: "sell_price",
  賣出價: "sell_price",
  sellfee: "sell_fee",
  fee: "sell_fee",
  手續費: "sell_fee",
  賣出手續費: "sell_fee",
  selltotal: "sell_total",
  proceeds: "sell_total",
  賣出總額: "sell_total",
  賣出金額: "sell_total",
  pnl: "pnl",
  pl: "pnl",
  盈虧: "pnl",
  損益: "pnl",
  hey: "split_hey",
  heypercent: "split_hey",
  hpercent: "split_hey",
  sze: "split_sze",
  szepercent: "split_sze",
  wah: "split_wah",
  wahpercent: "split_wah",
};

const ACCOUNT_ALIASES: Record<string, AccountTarget> = {
  date: "date",
  日期: "date",
  detail: "detail",
  particulars: "detail",
  明細: "detail",
  詳情: "detail",
  摘要: "detail",
  own: "own",
  owner: "own",
  持有: "own",
  hkd: "hkd",
  港元: "hkd",
  港幣: "hkd",
  fx: "fx",
  rate: "fx",
  匯率: "fx",
  usd: "usd",
  美元: "usd",
  inout: "in_out",
  inouts: "in_out",
  出入: "in_out",
  出入金: "in_out",
};

const TRANSINFO_REQUIRED: TransInfoTarget[] = ["symbol", "quantity", "own", "buy_date"];
const ACCOUNT_REQUIRED: AccountTarget[] = ["date", "own"];

export function normalizeHeader(header: string): string {
  return header
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./()（）：:]+/g, "");
}

export function guessTarget(kind: SheetKind, header: string): ColumnTarget | null {
  const key = normalizeHeader(header);
  if (!key) {
    return "ignore";
  }
  if (kind === "transinfo") {
    return TRANSINFO_ALIASES[key] ?? null;
  }
  return ACCOUNT_ALIASES[key] ?? null;
}

export function autoMapSheet(kind: SheetKind, headers: string[]): { map: ColumnMap; issues: MapIssue[] } {
  const targets: Array<ColumnTarget | null> = headers.map((header) => guessTarget(kind, header));
  const issues: MapIssue[] = [];
  const seen = new Map<string, string>();

  headers.forEach((header, index) => {
    const target = targets[index];
    if (target == null) {
      issues.push({
        kind: "unmapped_column",
        sheet: kind,
        header,
        message: `未識別欄「${header}」。確認對應或略過之後先寫入。`,
      });
      return;
    }
    if (target === "ignore") {
      return;
    }
    const prev = seen.get(target);
    if (prev) {
      issues.push({
        kind: "column_collision",
        sheet: kind,
        header,
        target,
        message: `「${prev}」同「${header}」都對去 ${target}。一欄只能對一個目標。`,
      });
    } else {
      seen.set(target, header);
    }
  });

  const required = kind === "transinfo" ? TRANSINFO_REQUIRED : ACCOUNT_REQUIRED;
  for (const need of required) {
    if (!seen.has(need)) {
      issues.push({
        kind: "missing_required",
        sheet: kind,
        target: need,
        message: `${kind === "transinfo" ? "TransInfo" : "Account Detail"} 缺咗必要欄：${need}`,
      });
    }
  }

  if (kind === "transinfo" && !seen.has("buy_total") && !seen.has("buy_price")) {
    issues.push({
      kind: "missing_required",
      sheet: kind,
      target: "buy_total",
      message: "TransInfo 要有買入總額或買入價。",
    });
  }
  if (kind === "account" && !seen.has("hkd") && !seen.has("usd")) {
    issues.push({
      kind: "missing_required",
      sheet: kind,
      target: "hkd",
      message: "Account Detail 要有港元或美元金額。",
    });
  }

  return { map: { kind, targets }, issues };
}

export function applyManualMap(
  kind: SheetKind,
  headers: string[],
  chosen: Array<ColumnTarget | null>,
): { map: ColumnMap; issues: MapIssue[] } {
  const targets = headers.map((_, index) => chosen[index] ?? null);
  const fakeHeaders = headers.map((header, index) =>
    targets[index] === "ignore" ? "" : header,
  );
  const { issues } = autoMapSheet(
    kind,
    fakeHeaders.map((header, index) => {
      if (targets[index] && targets[index] !== "ignore") {
        return header || String(targets[index]);
      }
      return header;
    }),
  );
  // Re-run collision/required against the chosen targets directly.
  const issuesDirect: MapIssue[] = [];
  const seen = new Map<string, string>();
  headers.forEach((header, index) => {
    const target = targets[index];
    if (target == null) {
      issuesDirect.push({
        kind: "unmapped_column",
        sheet: kind,
        header,
        message: `未識別欄「${header}」。確認對應或略過之後先寫入。`,
      });
      return;
    }
    if (target === "ignore") {
      return;
    }
    const prev = seen.get(target);
    if (prev) {
      issuesDirect.push({
        kind: "column_collision",
        sheet: kind,
        header,
        target,
        message: `「${prev}」同「${header}」都對去 ${target}。一欄只能對一個目標。`,
      });
    } else {
      seen.set(target, header);
    }
  });
  const required = kind === "transinfo" ? TRANSINFO_REQUIRED : ACCOUNT_REQUIRED;
  for (const need of required) {
    if (!seen.has(need)) {
      issuesDirect.push({
        kind: "missing_required",
        sheet: kind,
        target: need,
        message: `${kind === "transinfo" ? "TransInfo" : "Account Detail"} 缺咗必要欄：${need}`,
      });
    }
  }
  void issues;
  return { map: { kind, targets }, issues: issuesDirect };
}

export function mapUpload(
  transinfo: ParsedSheet,
  account: ParsedSheet,
  manual?: { transinfo?: Array<ColumnTarget | null>; account?: Array<ColumnTarget | null> },
): ColumnMapResult {
  const ti = manual?.transinfo
    ? applyManualMap("transinfo", transinfo.headers, manual.transinfo)
    : autoMapSheet("transinfo", transinfo.headers);
  const ad = manual?.account
    ? applyManualMap("account", account.headers, manual.account)
    : autoMapSheet("account", account.headers);
  const issues = [...ti.issues, ...ad.issues];
  return {
    transinfo: ti.map,
    account: ad.map,
    issues,
    blocking: issues.length > 0,
  };
}

export function cell(row: string[], map: ColumnMap, target: ColumnTarget): string {
  const index = map.targets.findIndex((item) => item === target);
  if (index < 0) {
    return "";
  }
  return (row[index] ?? "").trim();
}

export function detectSheetKind(name: string, headers: string[]): SheetKind | "unknown" {
  const n = normalizeHeader(name);
  if (n.includes("transinfo") || n.includes("交易")) {
    return "transinfo";
  }
  if (n.includes("accountdetail") || n.includes("帳戶") || n.includes("賬戶")) {
    return "account";
  }
  const guessed = headers.map((header) => guessTarget("transinfo", header));
  const accountGuessed = headers.map((header) => guessTarget("account", header));
  const tiHits = guessed.filter((item) => item && item !== "ignore").length;
  const adHits = accountGuessed.filter((item) => item && item !== "ignore").length;
  if (tiHits >= 3 && tiHits > adHits) {
    return "transinfo";
  }
  if (adHits >= 3 && adHits > tiHits) {
    return "account";
  }
  return "unknown";
}
