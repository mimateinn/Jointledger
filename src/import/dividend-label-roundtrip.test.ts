import { describe, expect, it, vi } from "vitest";
import { createAdjustment } from "@/ledger/create-adjustment";
import { addMember } from "@/ledger/add-member";
import { createBook } from "@/ledger/create-book";
import { createCashFlow } from "@/ledger/create-cash-flow";
import { createJointAccount } from "@/ledger/create-joint-account";
import { createMemoryStore } from "@/ledger/memory-store";
import { createTrade } from "@/ledger/create-trade";
import { isDividendNote } from "@/ledger/dividend";
import { ledgerKindLabel } from "@/lib/ledger-filter";
import { applyImport } from "./apply";
import { EXPORT_FILENAME, exportBookXlsx } from "./book-export";
import { mapUpload } from "./columns";
import { legacyExportDividendSheets } from "./fixtures/legacy-export-dividends";
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

describe("dividend label export / import", () => {
  it("round-trips the 股息 label through the new export format", async () => {
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
      symbol: "MSFT",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });
    await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      occurredOn: "2024-07-01",
      note: "股息 MSFT",
      symbol: "MSFT",
      amountUsd: "12.5",
    });
    await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      occurredOn: "2024-08-01",
      note: "rounding",
      amountUsd: "2.5",
    });

    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    const { transinfo, account: accountSheet } = pickSheets(parsed);
    const kindIndex = transinfo.headers.indexOf("種類");
    const symbolIndex = transinfo.headers.indexOf("股票代碼");
    const kinds = Object.fromEntries(transinfo.rows.map((row) => [row[symbolIndex], row[kindIndex]]));
    expect(kinds.MSFT).toBe("dividend");
    expect(kinds["—"]).toBe("adjustment");

    const mapping = mapUpload(transinfo, accountSheet);
    expect(mapping.blocking).toBe(false);
    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, accountSheet, mapping);
    const dividendPlan = plan.trades.find((row) => row.symbol === "MSFT" && row.side === "adjustment");
    const roundingPlan = plan.trades.find((row) => row.side === "adjustment" && row.symbol !== "MSFT");
    expect(isDividendNote(dividendPlan?.note)).toBe(true);
    expect(isDividendNote(roundingPlan?.note)).toBe(false);
    expect(roundingPlan?.note).toBe("rounding");

    const empty = createMemoryStore();
    const result = await applyImport(empty, plan, {
      createdByUserId: "user-2",
      creatorDisplayName: "Hey",
      decisions: importAll(plan),
    });
    const trades = await empty.listTrades(result.bookId);
    const importedDiv = trades.find((row) => row.symbol === "MSFT" && row.side === "adjustment");
    const importedAdj = trades.find((row) => row.side === "adjustment" && row.symbol !== "MSFT");
    expect(importedDiv).toBeTruthy();
    expect(isDividendNote(importedDiv?.note)).toBe(true);
    expect(ledgerKindLabel("adjustment", importedDiv?.note)).toBe("股息");
    expect(isDividendNote(importedAdj?.note)).toBe(false);
    expect(ledgerKindLabel("adjustment", importedAdj?.note)).toBe("調整");
  });

  it("imports a legacy export fixture; 股息 cells restore the label, old adjustment cells stay as before", async () => {
    const { transinfo, account } = legacyExportDividendSheets();
    const mapping = mapUpload(transinfo, account);
    expect(mapping.blocking).toBe(false);
    const plan = buildPlan("book-export.xlsx", "legacy-hash", transinfo, account, mapping);
    expect(plan.blocking).toBe(false);
    expect(plan.trades).toHaveLength(4);

    const buy = plan.trades.find((row) => row.symbol === "NVDA");
    const oldExportedDividend = plan.trades.find((row) => row.symbol === "MSFT");
    const rounding = plan.trades.find((row) => row.symbol === "—");
    const chineseDividend = plan.trades.find((row) => row.symbol === "AAPL");

    expect(buy?.side ?? "buy").toBe("buy");
    expect(oldExportedDividend?.side).toBe("adjustment");
    expect(isDividendNote(oldExportedDividend?.note)).toBe(false);
    expect(oldExportedDividend?.note).toMatch(/匯入調整/);
    expect(rounding?.side).toBe("adjustment");
    expect(isDividendNote(rounding?.note)).toBe(false);
    expect(chineseDividend?.side).toBe("adjustment");
    expect(isDividendNote(chineseDividend?.note)).toBe(true);

    const store = createMemoryStore();
    const { book } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    await addMember(store, { bookId: book.id, displayName: "Sze" });
    await createJointAccount(store, { bookId: book.id, name: "聯名" });

    const result = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "append" },
    });
    expect(result.tradeCount).toBe(4);
    const trades = await store.listTrades(book.id);
    const importedChinese = trades.find((row) => row.symbol === "AAPL");
    const importedOldDiv = trades.find((row) => row.symbol === "MSFT");
    const importedBuy = trades.find((row) => row.symbol === "NVDA");
    expect(importedBuy?.side).toBe("buy");
    expect(isDividendNote(importedChinese?.note)).toBe(true);
    expect(ledgerKindLabel("adjustment", importedChinese?.note)).toBe("股息");
    expect(isDividendNote(importedOldDiv?.note)).toBe(false);
    expect(ledgerKindLabel("adjustment", importedOldDiv?.note)).toBe("調整");
  });
});
