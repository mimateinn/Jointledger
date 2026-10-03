/**
 * Insert-only demo seed. Never deletes, migrates, or resets SQLite.
 * Safe to re-run: exits without writes when the target already exists.
 *
 *   pnpm exec tsx scripts/seed-demo.ts --user-only
 *   pnpm exec tsx scripts/seed-demo.ts
 */
import "dotenv/config";
import { count } from "drizzle-orm";
import { hashPassword } from "../src/auth/password";
import { getDb } from "../src/db/client";
import { insertFirstUser } from "../src/db/first-user";
import { createDrizzleStore } from "../src/db/drizzle-store";
import { books, cashFlows, trades, users } from "../src/db/tables";
import type { Book, LedgerAccount, Member } from "../src/ledger/types";
import { addMember } from "../src/ledger/add-member";
import { createAdjustment } from "../src/ledger/create-adjustment";
import { createBook } from "../src/ledger/create-book";
import { createCashFlow } from "../src/ledger/create-cash-flow";
import { createJointAccount } from "../src/ledger/create-joint-account";
import { createTrade } from "../src/ledger/create-trade";
import { setAllocationSchedule } from "../src/ledger/set-allocation-schedule";
import { addWatchItem } from "../src/watchlist/repo";

const DEMO_PASSWORD = "demo-pass-1";
const MEMBER_A = "Member A";
const MEMBER_B = "Member B";
const userOnly = process.argv.includes("--user-only");

async function ensureUser() {
  const db = getDb();
  const [row] = await db.select({ n: count() }).from(users);
  if (Number(row?.n ?? 0) > 0) {
    const [existing] = await db.select().from(users).limit(1);
    console.log(`seed: user exists (${existing?.displayName}), skip insert`);
    return existing;
  }
  const created = await insertFirstUser({
    displayName: MEMBER_A,
    email: null,
    passwordHash: await hashPassword(DEMO_PASSWORD),
  });
  if (!created.ok) {
    throw new Error("seed: first user insert failed");
  }
  console.log(`seed: created user ${MEMBER_A} (no email)`);
  return created.user;
}

async function ensureBook(user: { id: string; displayName: string }) {
  const db = getDb();
  const existingBooks = await db.select().from(books);
  const store = createDrizzleStore();

  let book: Book;
  let member: Member;
  let account: LedgerAccount;
  if (existingBooks[0]) {
    book = existingBooks[0];
    const [cf] = await db.select({ n: count() }).from(cashFlows);
    const [tr] = await db.select({ n: count() }).from(trades);
    if (Number(cf?.n ?? 0) > 0 || Number(tr?.n ?? 0) > 0) {
      console.log("seed: ledger already has rows, skip writes");
      return;
    }
    const listed = await store.listMembers(book.id);
    const accounts = await store.listLedgerAccounts(book.id);
    const existingMember = listed.find((row) => row.userId === user.id) ?? listed[0];
    const existingAccount = existingMember
      ? accounts.find((row) => row.memberId === existingMember.id && row.kind === "personal")
      : undefined;
    if (!existingMember || !existingAccount) {
      console.log("seed: existing book has no creator account, skip");
      return;
    }
    member = existingMember;
    account = existingAccount;
    console.log("seed: empty book exists, insert demo rows only");
  } else {
    const created = await createBook(store, {
      name: "聯倉",
      createdByUserId: user.id,
      creatorDisplayName: user.displayName,
      creatorEmail: null,
    });
    book = created.book;
    member = created.member;
    account = created.account;
  }

  const { member: memberB, account: accountB } = await addMember(store, {
    bookId: book.id,
    displayName: MEMBER_B,
  });
  const joint = await createJointAccount(store, { bookId: book.id, name: "聯名" });
  await setAllocationSchedule(store, {
    bookId: book.id,
    effectiveOn: "2025-01-01",
    legs: [
      { memberId: member.id, percent: "60" },
      { memberId: memberB.id, percent: "40" },
    ],
  });

  await createCashFlow(store, {
    bookId: book.id,
    memberId: member.id,
    ledgerAccountId: account.id,
    kind: "deposit",
    amountHkd: "100000",
    fxRate: "7.80",
    occurredOn: "2025-01-15",
  });
  await createCashFlow(store, {
    bookId: book.id,
    memberId: memberB.id,
    ledgerAccountId: accountB.id,
    kind: "deposit",
    amountHkd: "80000",
    fxRate: "7.80",
    occurredOn: "2025-01-16",
  });
  await createCashFlow(store, {
    bookId: book.id,
    memberId: member.id,
    ledgerAccountId: account.id,
    kind: "withdrawal",
    amountHkd: "5000",
    fxRate: "7.80",
    occurredOn: "2025-06-01",
  });

  await createTrade(store, {
    bookId: book.id,
    ledgerAccountId: account.id,
    memberId: member.id,
    symbol: "AAPL",
    quantity: "10",
    price: "180",
    occurredOn: "2025-02-01",
    note: "personal lot",
    side: "buy",
  });
  await createTrade(store, {
    bookId: book.id,
    ledgerAccountId: accountB.id,
    memberId: memberB.id,
    symbol: "NVDA",
    quantity: "5",
    price: "120",
    occurredOn: "2025-02-10",
    note: "personal lot",
    side: "buy",
  });
  await createTrade(store, {
    bookId: book.id,
    ledgerAccountId: joint.id,
    memberId: member.id,
    symbol: "MSFT",
    quantity: "8",
    price: "400",
    occurredOn: "2025-03-01",
    note: "joint lot",
    side: "buy",
    legs: [
      { memberId: member.id, quantity: "4.8", costUsd: "1920" },
      { memberId: memberB.id, quantity: "3.2", costUsd: "1280" },
    ],
  });
  await createAdjustment(store, {
    bookId: book.id,
    ledgerAccountId: account.id,
    memberId: member.id,
    occurredOn: "2025-04-01",
    note: "rounding",
    amountUsd: "2.50",
  });

  for (const code of ["AAPL", "NVDA", "0700.HK"]) {
    await addWatchItem(book.id, code);
  }

  console.log(`seed: book ${book.id} with ${MEMBER_A} / ${MEMBER_B}, cash, trades, watchlist`);
}

async function main() {
  const user = await ensureUser();
  if (!user) {
    throw new Error("seed: no user");
  }
  if (userOnly) {
    console.log("seed: --user-only, stop before book");
    return;
  }
  await ensureBook({ id: user.id, displayName: user.displayName });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
