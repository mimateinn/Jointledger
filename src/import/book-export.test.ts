import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAdjustment } from "@/ledger/create-adjustment";
import { createBook } from "@/ledger/create-book";
import { createCashFlow } from "@/ledger/create-cash-flow";
import { createSplit } from "@/ledger/create-split";
import { createTrade } from "@/ledger/create-trade";
import { createMemoryStore } from "@/ledger/memory-store";
import { openLotsFromTrades, summarizeLedger } from "@/ledger/summary";
import { applyImport } from "./apply";
import {
  ACCOUNT_EXPORT_HEADERS,
  ACCOUNT_SHEET_NAME,
  EXPORT_FILENAME,
  TRANSINFO_EXPORT_HEADERS,
  TRANSINFO_SHEET_NAME,
  exportBookXlsx,
} from "./book-export";
import { mapUpload } from "./columns";
import { buildPlan } from "./plan";

vi.mock("server-only", () => ({}));

const { parseUpload, pickSheets } = await import("./parse");

function importAll(plan: ReturnType<typeof buildPlan>) {
  const pending: Record<string, "import" | "skip"> = {};
  for (const issue of plan.issues.filter((item) => item.pending)) {
    pending[issue.id] = "import";
  }
  return { pending };
}

describe("local two-sheet xlsx export", () => {
  it("round-trips deposit + buy through the existing import mapper", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });

    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    const { transinfo, account: accountSheet } = pickSheets(parsed);

    expect(transinfo.name).toBe(TRANSINFO_SHEET_NAME);
    expect(accountSheet.name).toBe(ACCOUNT_SHEET_NAME);
    expect(transinfo.headers).toEqual([...TRANSINFO_EXPORT_HEADERS]);
    expect(accountSheet.headers).toEqual([...ACCOUNT_EXPORT_HEADERS]);

    const mapping = mapUpload(transinfo, accountSheet);
    expect(mapping.blocking).toBe(false);
    expect(mapping.issues).toHaveLength(0);

    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, accountSheet, mapping);
    expect(plan.blocking).toBe(false);

    const empty = createMemoryStore();
    const result = await applyImport(empty, plan, {
      createdByUserId: "user-2",
      creatorDisplayName: "Hey",
      decisions: importAll(plan),
    });
    const cashFlows = await empty.listCashFlows(result.bookId);
    const trades = await empty.listTrades(result.bookId);
    const allocations = await empty.listTradeAllocations(result.bookId);
    const lots = openLotsFromTrades(trades, allocations);
    const snap = summarizeLedger(cashFlows, allocations, lots);
    expect(snap.cashUsd.toFixed(2)).toBe("500.00");
    expect(snap.navUsd.toFixed(2)).not.toBe("1500.00");
  });

  it("exports split and adjustment kinds; import skips those rows", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });
    await createSplit(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      newShares: "2",
      oldShares: "1",
      occurredOn: "2024-01-03",
    });
    await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      occurredOn: "2024-01-04",
      note: "rounding",
      amountUsd: "1",
    });

    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    const { transinfo, account: accountSheet } = pickSheets(parsed);
    expect(transinfo.headers).toContain("種類");
    const kinds = transinfo.rows.map((row) => row[transinfo.headers.indexOf("種類")]);
    expect(kinds).toEqual(expect.arrayContaining(["buy", "split", "adjustment"]));

    const mapping = mapUpload(transinfo, accountSheet);
    expect(mapping.blocking).toBe(false);
    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, accountSheet, mapping);
    expect(plan.trades.every((trade) => trade.symbol === "NVDA")).toBe(true);
    expect(plan.trades).toHaveLength(1);
  });

  it("writes local bytes with no Sheets/OAuth", () => {
    const xlsx = readFileSync(join(process.cwd(), "src/google/xlsx.ts"), "utf8");
    expect(xlsx).toContain("exceljs");
    expect(xlsx).not.toMatch(/googleapis|OAuth|gapi/i);
    expect(xlsx).not.toMatch(/sheets\.googleapis|spreadsheets\.values/i);
    const payload = readFileSync(join(process.cwd(), "src/import/export-payload.ts"), "utf8");
    expect(payload).toContain("split");
    expect(payload).toContain("adjustment");
  });

  it("writes only the English filename and never secrets", () => {
    expect(EXPORT_FILENAME).toBe("book-export.xlsx");
    expect(EXPORT_FILENAME).toMatch(/^[A-Za-z0-9._-]+$/);
    const src = readFileSync(join(process.cwd(), "src/import/book-export.ts"), "utf8");
    expect(src).not.toMatch(/passwordHash|inviteSecret|SESSION|process\.env/);
    expect(src).not.toMatch(/gmail\.com/);
  });

  it("export route returns 401 in-handler and middleware does not redirect it", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/export/route.ts"), "utf8");
    expect(route).toContain("export async function GET");
    expect(route).toMatch(/401/);
    expect(route).toMatch(/403/);
    expect(route).toContain("getSessionUser");
    expect(route).toContain("EXPORT_FILENAME");
    expect(route).not.toMatch(/redirect\(/);
    const alias = readFileSync(join(process.cwd(), "src/app/api/export/xlsx/route.ts"), "utf8");
    expect(alias).toContain("export { GET }");
    const middleware = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
    expect(middleware).toContain('"/api/export"');
    expect(middleware).toContain('"/api/export/xlsx"');
    expect(middleware).toMatch(/authInHandler\.has\(pathname\)/);
  });
});
