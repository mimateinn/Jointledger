export type SheetKind = "transinfo" | "account";
export type ExtraSheetKind = "members" | "allocation" | "tradesplits";

export type TransInfoTarget =
  | "symbol"
  | "quantity"
  | "own"
  | "buy_date"
  | "buy_price"
  | "buy_total"
  | "buy_fee"
  | "sell_date"
  | "sell_price"
  | "sell_fee"
  | "sell_total"
  | "pnl"
  | "row_kind"
  | "note"
  | "trade_id"
  | "split_hey"
  | "split_sze"
  | "split_wah";

export type AccountTarget = "date" | "detail" | "own" | "hkd" | "fx" | "usd" | "in_out";

export type ColumnTarget = TransInfoTarget | AccountTarget | "ignore";

export type ParsedSheet = {
  kind: SheetKind | ExtraSheetKind | "unknown";
  name: string;
  headers: string[];
  rows: string[][];
};

export type ImportExtras = {
  members?: ParsedSheet;
  allocation?: ParsedSheet;
  tradeSplits?: ParsedSheet;
};

export type ParsedUpload = {
  filename: string;
  fileHash: string;
  sheets: ParsedSheet[];
};

export type ColumnMap = {
  kind: SheetKind;
  /** header index → target. Missing index = unmapped. */
  targets: Array<ColumnTarget | null>;
};

export type MapIssue = {
  kind: "unmapped_column" | "column_collision" | "missing_required";
  sheet: SheetKind;
  header?: string;
  target?: string;
  message: string;
};

export type ColumnMapResult = {
  transinfo: ColumnMap;
  account: ColumnMap;
  issues: MapIssue[];
  blocking: boolean;
};

export type IssueKind =
  | "unmapped_column"
  | "column_collision"
  | "missing_required"
  | "open_lot"
  | "retro_split"
  | "mismatch"
  | "joint_mismatch"
  | "unknown_own"
  | "unknown_member"
  | "empty_holder"
  | "ambiguous_holder"
  | "allocation_invalid"
  | "tradesplit_invalid"
  | "duplicate_member"
  | "kept_member"
  | "removed_member"
  | "schedule_member_missing"
  | "missing_fx"
  | "missing_date"
  | "missing_qty"
  | "missing_amount"
  | "reimport";

export type ImportIssue = {
  id: string;
  sheet: SheetKind | ExtraSheetKind | "all";
  row: number;
  symbol?: string;
  own?: string;
  kind: IssueKind;
  message: string;
  pending: boolean;
};

export type BookKind = "hey" | "sze" | "wah" | "joint" | "personal";

export type PlannedAllocationLeg = {
  memberName: string;
  percent: string;
};

export type PlannedAllocationSchedule = {
  effectiveOn: string;
  legs: PlannedAllocationLeg[];
};

export type PlannedCashFlow = {
  id: string;
  row: number;
  own: string;
  book: BookKind;
  memberName: string;
  kind: "deposit" | "withdrawal";
  amountHkd: string;
  fxRate: string;
  occurredOn: string;
  detail: string;
  skip: boolean;
  warningIds: string[];
  holderError?: "empty" | "unknown" | "ambiguous";
};

export type PlannedTrade = {
  id: string;
  row: number;
  symbol: string;
  own: string;
  book: BookKind;
  quantity: string;
  buyDate: string;
  buyPrice: string;
  buyTotal: string;
  buyFee?: string | null;
  sellDate: string | null;
  sellPrice: string | null;
  sellFee: string | null;
  sellTotal: string | null;
  /** Old-sheet Net P/L. Comparison only — never written to CashFlow/Trade. */
  sheetPnl: string | null;
  memberName: string;
  side?: "buy" | "sell" | "split" | "adjustment";
  note?: string | null;
  skip: boolean;
  pending: boolean;
  warningIds: string[];
  holderError?: "empty" | "unknown" | "ambiguous";
  /** Stable id from the export TradeId column; used to attach TradeSplits. */
  exportId?: string;
  /** v0.1.12 F / 聯名（Hey + Sze） → Hey/Sze 50/50 even if Wah is a member. */
  legacyHeySze?: boolean;
  customLegs?: { memberName: string; quantity: string; costUsd: string; proceedsUsd: string }[];
};

export type OwnAccountMap = {
  own: string;
  account: string;
};

export type ImportPlan = {
  filename: string;
  fileHash: string;
  members: string[];
  /** Names from the Members sheet only. Empty when the file has no Members sheet. */
  listedMembers: string[];
  ownMapping: OwnAccountMap[];
  schedules: PlannedAllocationSchedule[];
  /** True when the upload included an Allocation sheet (even if empty). Missing sheet ≠ empty sheet. */
  hasAllocationSheet: boolean;
  /** True when the upload included a Members sheet (even if empty). */
  hasMembersSheet: boolean;
  cashFlows: PlannedCashFlow[];
  trades: PlannedTrade[];
  issues: ImportIssue[];
  blocking: boolean;
  counts: {
    members: number;
    cashFlows: number;
    trades: number;
    errors: number;
    warnings: number;
    skipped: number;
    pending: number;
  };
};

export type PendingChoice = "import" | "skip";

export type ImportDecisions = {
  pending: Record<string, PendingChoice>;
  reimportMode?: "initial" | "append" | "replace";
  bookName?: string;
};

export type ImportBatchStatus = "draft" | "pending" | "success" | "warning" | "skipped" | "failed";
