export const LEDGER_KINDS = [
  "deposit",
  "withdrawal",
  "buy",
  "sell",
  "split",
  "adjustment",
] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number];
export type LedgerView = "cash" | "trades";

export type LedgerFilters = {
  q: string;
  type: "" | LedgerKind;
  member: string;
  from: string;
  to: string;
  view: LedgerView;
};

export type FilterableLedgerRow = {
  id: string;
  kind: LedgerKind;
  occurredOn: string;
  memberName: string;
  symbol?: string;
  name?: string | null;
  note?: string | null;
};

const KIND_SET = new Set<string>(LEDGER_KINDS);

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  deposit: "入金",
  withdrawal: "出金",
  buy: "買入",
  sell: "賣出",
  split: "拆股",
  adjustment: "調整",
};

export function emptyLedgerFilters(view: LedgerView = "trades"): LedgerFilters {
  return { q: "", type: "", member: "", from: "", to: "", view };
}

export function parseLedgerFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): LedgerFilters {
  const get = (key: string): string => {
    if (input instanceof URLSearchParams) {
      return (input.get(key) ?? "").trim();
    }
    const value = input[key];
    if (Array.isArray(value)) {
      return (value[0] ?? "").trim();
    }
    return (value ?? "").trim();
  };
  const typeRaw = get("type");
  const viewRaw = get("view");
  return {
    q: get("q"),
    type: KIND_SET.has(typeRaw) ? (typeRaw as LedgerKind) : "",
    member: get("member"),
    from: get("from"),
    to: get("to"),
    view: viewRaw === "cash" ? "cash" : "trades",
  };
}

export function ledgerFiltersActive(filters: Pick<LedgerFilters, "q" | "type" | "member" | "from" | "to">): boolean {
  return Boolean(filters.q || filters.type || filters.member || filters.from || filters.to);
}

export function ledgerFiltersToSearch(filters: LedgerFilters): string {
  const params = new URLSearchParams();
  if (filters.view !== "trades") {
    params.set("view", filters.view);
  }
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.member) params.set("member", filters.member);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function isCashKind(kind: LedgerKind): boolean {
  return kind === "deposit" || kind === "withdrawal";
}

export function matchesLedgerRow(row: FilterableLedgerRow, filters: LedgerFilters): boolean {
  if (filters.view === "cash" && !isCashKind(row.kind)) {
    return false;
  }
  if (filters.view === "trades" && isCashKind(row.kind)) {
    return false;
  }
  if (filters.type && row.kind !== filters.type) {
    return false;
  }
  if (filters.member && row.memberName !== filters.member) {
    return false;
  }
  const day = row.occurredOn.slice(0, 10);
  if (filters.from && day < filters.from) {
    return false;
  }
  if (filters.to && day > filters.to) {
    return false;
  }
  const q = filters.q.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const hay = [row.symbol, row.name, row.note, row.memberName, LEDGER_KIND_LABEL[row.kind]]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function filterLedgerRows<T extends FilterableLedgerRow>(rows: T[], filters: LedgerFilters): T[] {
  return rows.filter((row) => matchesLedgerRow(row, filters));
}

export function kindsForView(view: LedgerView): LedgerKind[] {
  return LEDGER_KINDS.filter((kind) => (view === "cash" ? isCashKind(kind) : !isCashKind(kind)));
}
