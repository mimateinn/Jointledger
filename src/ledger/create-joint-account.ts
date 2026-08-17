import type { LedgerStore } from "./store";
import type { CreateJointAccountInput, LedgerAccount } from "./types";

export async function createJointAccount(
  store: LedgerStore,
  input: CreateJointAccountInput,
): Promise<LedgerAccount> {
  const name = input.name?.trim() || "聯名";
  return store.insertLedgerAccount({
    bookId: input.bookId,
    memberId: null,
    kind: "joint",
    name,
  });
}
