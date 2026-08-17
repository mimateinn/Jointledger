export type SheetKind = "transinfo" | "account";

export type TransInfoTarget =
  | "symbol"
  | "quantity"
  | "own"
  | "buy_date"
  | "buy_price"
  | "buy_total"
  | "sell_date"
  | "sell_price"
  | "sell_fee"
  | "sell_total"
  | "pnl"
  | "split_hey"
  | "split_sze"
  | "split_wah";

export type AccountTarget = "date" | "detail" | "own" | "hkd" | "fx" | "usd" | "in_out";

export type ColumnTarget = TransInfoTarget | AccountTarget | "ignore";

export type ParsedSheet = {
  kind: SheetKind | "unknown";
  name: string;
  headers: string[];
  rows: string[][];
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
  | "missing_fx"
  | "missing_date"
  | "missing_qty"
  | "missing_amount"
  | "reimport";

export type ImportIssue = {
  id: string;
  sheet: SheetKind | "all";
  row: number;
  symbol?: string;
  own?: string;
  kind: IssueKind;
  message: string;
  pending: boolean;
};

export type BookKind = "hey" | "sze" | "wah" | "joint";

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
  sellDate: string | null;
  sellPrice: string | null;
  sellFee: string | null;
  sellTotal: string | null;
  skip: boolean;
  pending: boolean;
  warningIds: string[];
};

export type OwnAccountMap = {
  own: string;
  account: string;
};

export type ImportPlan = {
  filename: string;
  fileHash: string;
  members: string[];
  ownMapping: OwnAccountMap[];
  cashFlows: PlannedCashFlow[];
  trades: PlannedTrade[];
  issues: ImportIssue[];
  blocking: boolean;
  counts: {
    members: number;
    cashFlows: number;
    trades: number;
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
