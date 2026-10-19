import { describe, expect, it } from "vitest";
import { addMember } from "./add-member";
import { createBook } from "./create-book";
import { createCashFlow } from "./create-cash-flow";
import { createMemoryStore } from "./memory-store";

describe("memory store removeUnclaimedMember", () => {
  it("never prunes a member who still has cash flows (t7)", async () => {
    const store = createMemoryStore();
    const { book, member: hey, account } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    await addMember(store, { bookId: book.id, displayName: "Sze" });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: hey.id,
      ledgerAccountId: account.id,
      kind: "deposit",
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    const storedHey = store.members.find((row) => row.id === hey.id);
    if (storedHey) {
      storedHey.userId = null;
    }
    await store.removeUnclaimedMember(book.id, hey.id);
    const members = await store.listMembers(book.id);
    expect(members.map((row) => row.displayName)).toContain("Hey");
    expect(await store.listCashFlows(book.id)).toHaveLength(1);
  });
});
