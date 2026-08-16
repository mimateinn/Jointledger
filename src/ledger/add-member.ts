import type { LedgerStore } from "./store";
import type { AddMemberInput, LedgerAccount, Member } from "./types";

export async function addMember(
  store: LedgerStore,
  input: AddMemberInput,
): Promise<{ member: Member; account: LedgerAccount }> {
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error("要寫顯示名");
  }

  const email = input.email?.trim() ? input.email.trim() : null;

  const member = await store.insertMember({
    bookId: input.bookId,
    userId: input.userId ?? null,
    displayName,
    email,
  });

  const account = await store.insertLedgerAccount({
    bookId: input.bookId,
    memberId: member.id,
    kind: "personal",
    name: displayName,
  });

  return { member, account };
}
