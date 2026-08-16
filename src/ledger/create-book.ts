import type { LedgerStore } from "./store";
import type { Book, LedgerAccount, Member, CreateBookInput } from "./types";

export async function createBook(
  store: LedgerStore,
  input: CreateBookInput,
): Promise<{ book: Book; member: Member; account: LedgerAccount }> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("要寫記帳表名稱");
  }

  const book = await store.insertBook({
    name,
    tradeCurrency: input.tradeCurrency ?? "USD",
    depositCurrency: input.depositCurrency ?? "HKD",
    createdByUserId: input.createdByUserId,
  });

  const member = await store.insertMember({
    bookId: book.id,
    userId: input.createdByUserId,
    displayName: input.creatorDisplayName,
    email: input.creatorEmail ?? null,
  });

  const account = await store.insertLedgerAccount({
    bookId: book.id,
    memberId: member.id,
    kind: "personal",
    name: input.creatorDisplayName,
  });

  return { book, member, account };
}
