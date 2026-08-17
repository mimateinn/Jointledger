export type ClaimableMember = {
  id: string;
  displayName: string;
  email: string | null;
  userId: string | null;
  inviteSecretHash?: string | null;
  inviteExpiresAt?: Date | null;
};

export type ClaimReason = "no_secret" | "not_found" | "wrong_secret" | "expired" | "used";

export type ClaimDecision =
  | { ok: true; member: ClaimableMember }
  | { ok: false; reason: ClaimReason };

export function matchClaimableMember(
  members: ClaimableMember[],
  identifier: string,
): ClaimableMember | null {
  const raw = identifier.trim();
  if (!raw) {
    return null;
  }
  const lowered = raw.toLowerCase();
  return (
    members.find(
      (row) =>
        !row.userId &&
        (row.displayName === raw || (row.email != null && row.email.toLowerCase() === lowered)),
    ) ?? null
  );
}

/**
 * Name / email only identify the row. The invite secret is the capability.
 * A successful decision binds that member only.
 */
export async function evaluateClaim(input: {
  members: ClaimableMember[];
  identifier: string;
  inviteSecret: string;
  now?: Date;
  verify: (hash: string, secret: string) => Promise<boolean>;
}): Promise<ClaimDecision> {
  const secret = input.inviteSecret.trim();
  if (!secret) {
    return { ok: false, reason: "no_secret" };
  }
  const member = matchClaimableMember(input.members, input.identifier);
  if (!member) {
    return { ok: false, reason: "not_found" };
  }
  if (member.userId || !member.inviteSecretHash) {
    return { ok: false, reason: "used" };
  }
  const expires = member.inviteExpiresAt;
  if (!expires || expires.getTime() <= (input.now ?? new Date()).getTime()) {
    return { ok: false, reason: "expired" };
  }
  const ok = await input.verify(member.inviteSecretHash, secret);
  if (!ok) {
    return { ok: false, reason: "wrong_secret" };
  }
  return { ok: true, member };
}

export function claimErrorMessage(reason: ClaimReason): string {
  if (reason === "no_secret") {
    return "要寫邀請密鑰。顯示名或電郵唔夠認領。";
  }
  if (reason === "not_found") {
    return "搵唔到未設密碼嘅成員。請而家用緊嘅人先加你嘅顯示名。";
  }
  if (reason === "expired") {
    return "邀請密鑰已過期。請對方再發一次。";
  }
  if (reason === "used") {
    return "邀請密鑰已用過或未發出。";
  }
  return "邀請密鑰不正確。";
}
