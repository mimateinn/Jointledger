import { randomBytes } from "node:crypto";

/** 7 calendar days. Single-use; plaintext is never stored. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function mintInviteSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function inviteExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}
