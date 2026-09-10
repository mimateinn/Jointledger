import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { members } from "@/db/tables";
import { inviteExpiry, mintInviteSecret } from "./invite";
import { hashPassword } from "./password";

export async function persistInvite(
  secret: string,
  now = new Date(),
): Promise<{ inviteSecretHash: string; inviteExpiresAt: Date }> {
  return {
    inviteSecretHash: await hashPassword(secret),
    inviteExpiresAt: inviteExpiry(now),
  };
}

/** Hash + expiry only. Returns the plaintext once for the caller to show. */
export async function writeInvite(memberId: string, bookId: string, secret?: string | null): Promise<string> {
  const plaintext = (secret ?? "").trim() || mintInviteSecret();
  const fields = await persistInvite(plaintext);
  const db = getDb();
  await db
    .update(members)
    .set({
      inviteSecretHash: fields.inviteSecretHash,
      inviteExpiresAt: fields.inviteExpiresAt,
    })
    .where(and(eq(members.id, memberId), eq(members.bookId, bookId)));
  return plaintext;
}
