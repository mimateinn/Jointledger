import { isDividendNote } from "@/ledger/dividend";

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

export const JOINT_MEMBER = "joint";
export const JOINT_MEMBER_LABEL = "聯名";

export type FilterableLedgerRow = {
  id: string;
  kind: LedgerKind;
  occurredOn: string;
  memberName: string;
  memberIds?: string[];
  joint?: boolean;
  symbol?: string;
  name?: string | null;
  note?: string | null;
};

export type LedgerMemberOption = {
  id: string;
  displayName: string;
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

export function emptyLedgerFilters(view: LedgerView = "cash"): LedgerFilters {
  return { q: "", type: "", member: "", from: "", to: "", view };
}

export function parseLedgerFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  members: LedgerMemberOption[] = [],
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
  const view: LedgerView = viewRaw === "trades" ? "trades" : "cash";
  return {
    q: get("q"),
    type: KIND_SET.has(typeRaw) ? (typeRaw as LedgerKind) : "",
    member: memberForView(normalizeLedgerMember(get("member"), members), view),
    from: get("from"),
    to: get("to"),
    view,
  };
}

export function ledgerFiltersActive(filters: Pick<LedgerFilters, "q" | "type" | "member" | "from" | "to">): boolean {
  return Boolean(filters.q || filters.type || filters.member || filters.from || filters.to);
}

export function ledgerFiltersToSearch(filters: LedgerFilters): string {
  const params = new URLSearchParams();
  if (filters.view !== "cash") {
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
  const member = memberForView(filters.member, filters.view);
  if (member && !rowMatchesMember(row, member, [])) {
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

export function isJointMemberFilter(member: string): boolean {
  return member === JOINT_MEMBER || member === JOINT_MEMBER_LABEL;
}

export function memberForView(member: string, view: LedgerView): string {
  if (view !== "trades" && isJointMemberFilter(member)) {
    return "";
  }
  return member;
}

export function normalizeLedgerMember(
  raw: string,
  members: LedgerMemberOption[] = [],
): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (isJointMemberFilter(value)) {
    return JOINT_MEMBER;
  }
  const hit = members.find((member) => member.id === value || member.displayName === value);
  return hit?.id ?? value;
}

export function rowMatchesMember(
  row: FilterableLedgerRow,
  member: string,
  members: LedgerMemberOption[] = [],
): boolean {
  const resolved = normalizeLedgerMember(member, members);
  if (isJointMemberFilter(resolved)) {
    return Boolean(row.joint) || isJointMemberFilter(row.memberName);
  }
  if (row.memberIds?.includes(resolved) || row.memberName === resolved) {
    return true;
  }
  const alias = members.find((item) => item.id === resolved || item.displayName === resolved);
  if (!alias) {
    return row.memberName === member;
  }
  return Boolean(row.memberIds?.includes(alias.id) || row.memberName === alias.displayName);
}

export function filterLedgerRows<T extends FilterableLedgerRow>(
  rows: T[],
  filters: LedgerFilters,
  members: LedgerMemberOption[] = [],
): T[] {
  const member = memberForView(normalizeLedgerMember(filters.member, members), filters.view);
  return rows.filter((row) => matchesLedgerRow(row, { ...filters, member }));
}

export function kindsForView(view: LedgerView): LedgerKind[] {
  return LEDGER_KINDS.filter((kind) => (view === "cash" ? isCashKind(kind) : !isCashKind(kind)));
}

export function ledgerKindLabel(kind: LedgerKind, note?: string | null): string {
  if (kind === "adjustment" && isDividendNote(note)) {
    return "股息";
  }
  return LEDGER_KIND_LABEL[kind];
}
