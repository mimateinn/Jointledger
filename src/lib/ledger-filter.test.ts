import { describe, expect, it } from "vitest";
import {
  emptyLedgerFilters,
  filterLedgerRows,
  ledgerFiltersActive,
  ledgerFiltersToSearch,
  parseLedgerFilters,
  type FilterableLedgerRow,
} from "./ledger-filter";

const rows: FilterableLedgerRow[] = [
  { id: "c1", kind: "deposit", occurredOn: "2026-09-01", memberName: "Member A", note: "first in" },
  { id: "c2", kind: "withdrawal", occurredOn: "2026-09-20", memberName: "Member B", note: "out" },
  {
    id: "t1",
    kind: "buy",
    occurredOn: "2026-09-10",
    memberName: "Member A",
    symbol: "NVDA",
    name: "NVIDIA",
    note: "add lot",
  },
  {
    id: "t2",
    kind: "adjustment",
    occurredOn: "2026-10-01",
    memberName: "Member B",
    symbol: "0700.HK",
    name: "Tencent",
    note: "round",
  },
];

describe("ledger filter", () => {
  it("parses query string and ignores unknown type", () => {
    const filters = parseLedgerFilters(new URLSearchParams("q=nvda&type=buy&member=Member%20A&from=2026-09-01&view=trades"));
    expect(filters).toEqual({
      q: "nvda",
      type: "buy",
      member: "Member A",
      from: "2026-09-01",
      to: "",
      view: "trades",
    });
    expect(parseLedgerFilters({ type: "hack", view: "cash" }).type).toBe("");
    expect(parseLedgerFilters({ view: "cash" }).view).toBe("cash");
    expect(parseLedgerFilters({}).view).toBe("cash");
  });

  it("filters by text across code, name, note, and member", () => {
    const base = emptyLedgerFilters("trades");
    expect(filterLedgerRows(rows, { ...base, q: "nvda" }).map((r) => r.id)).toEqual(["t1"]);
    expect(filterLedgerRows(rows, { ...base, q: "tencent" }).map((r) => r.id)).toEqual(["t2"]);
    expect(filterLedgerRows(rows, { ...base, q: "add lot" }).map((r) => r.id)).toEqual(["t1"]);
    expect(filterLedgerRows(rows, { ...emptyLedgerFilters("cash"), q: "member b" }).map((r) => r.id)).toEqual(["c2"]);
  });

  it("filters by type, member, and date range", () => {
    const trades = emptyLedgerFilters("trades");
    expect(filterLedgerRows(rows, { ...trades, type: "buy" }).map((r) => r.id)).toEqual(["t1"]);
    expect(filterLedgerRows(rows, { ...trades, member: "Member B" }).map((r) => r.id)).toEqual(["t2"]);
    expect(filterLedgerRows(rows, { ...trades, from: "2026-09-15", to: "2026-10-31" }).map((r) => r.id)).toEqual(["t2"]);
    expect(filterLedgerRows(rows, { ...emptyLedgerFilters("cash"), type: "deposit" }).map((r) => r.id)).toEqual(["c1"]);
  });

  it("keeps view split and reports active filters", () => {
    const trades = emptyLedgerFilters("trades");
    expect(filterLedgerRows(rows, trades).map((r) => r.id)).toEqual(["t1", "t2"]);
    expect(filterLedgerRows(rows, emptyLedgerFilters("cash")).map((r) => r.id)).toEqual(["c1", "c2"]);
    expect(ledgerFiltersActive(trades)).toBe(false);
    expect(ledgerFiltersActive({ ...trades, q: "n" })).toBe(true);
    expect(ledgerFiltersToSearch({ ...trades, q: "nvda", type: "buy" })).toBe("?view=trades&q=nvda&type=buy");
    expect(ledgerFiltersToSearch(emptyLedgerFilters("cash"))).toBe("");
    expect(ledgerFiltersToSearch(emptyLedgerFilters())).toEqual(ledgerFiltersToSearch(emptyLedgerFilters("cash")));
  });

  it("matches joint trades by member id, display name, or the 聯名 option", () => {
    const members = [
      { id: "mem-a", displayName: "Member A" },
      { id: "mem-b", displayName: "Member B" },
    ];
    const joint: FilterableLedgerRow = {
      id: "j1",
      kind: "buy",
      occurredOn: "2026-09-12",
      memberName: "聯名",
      memberIds: ["mem-a", "mem-b"],
      joint: true,
      symbol: "MSFT",
    };
    const trades = emptyLedgerFilters("trades");
    expect(filterLedgerRows([joint], { ...trades, member: "mem-a" }, members).map((r) => r.id)).toEqual(["j1"]);
    expect(filterLedgerRows([joint], { ...trades, member: "Member A" }, members).map((r) => r.id)).toEqual(["j1"]);
    expect(filterLedgerRows([joint], { ...trades, member: "聯名" }, members).map((r) => r.id)).toEqual(["j1"]);
    expect(filterLedgerRows([joint], { ...trades, member: "joint" }, members).map((r) => r.id)).toEqual(["j1"]);
    expect(parseLedgerFilters({ member: "Member A" }, members).member).toBe("mem-a");
    expect(parseLedgerFilters({ member: "聯名" }, members).member).toBe("joint");
  });
});
