"use server";

import { count, eq, isNull, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { claimErrorMessage, evaluateClaim } from "@/auth/claim";
import { createSession, destroySession } from "@/auth/session";
import { hashPassword, verifyPassword } from "@/auth/password";
import { getDb } from "@/db/client";
import { insertFirstUser } from "@/db/first-user";
import { xactLockSql } from "@/db/xact-lock";
import { members, users } from "@/db/tables";

export type AuthState = { error?: string };

export async function userCount(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ n: count() }).from(users);
  return Number(row?.n ?? 0);
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!displayName) {
    return { error: "要寫顯示名" };
  }
  if (password.length < 8) {
    return { error: "密碼至少 8 個字" };
  }

  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const passwordHash = await hashPassword(password);

  // Serialize first-user signup: a count check alone races when the table is empty
  // (FOR UPDATE locks zero rows). Advisory lock + re-check inside one transaction.
  const result = await insertFirstUser({ displayName, email, passwordHash });

  if (!result.ok) {
    return { error: "系統已有用戶。請登入，或請現有成員先加你嘅顯示名。" };
  }

  await createSession(result.user.id);
  redirect("/first-use");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) {
    return { error: "要寫電郵或顯示名，同密碼" };
  }

  const db = getDb();
  const lowered = identifier.toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.displayName, identifier), sql`lower(${users.email}) = ${lowered}`))
    .limit(1);

  if (!user?.passwordHash) {
    return { error: "登入資料不正確" };
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    return { error: "登入資料不正確" };
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Bind a password to an existing Member. Requires that member's invite secret. */
export async function claimAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const inviteSecret = String(formData.get("inviteSecret") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) {
    return { error: "要寫顯示名或電郵，同密碼" };
  }
  if (password.length < 8) {
    return { error: "密碼至少 8 個字" };
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    await tx.execute(xactLockSql(87241002));
    const unclaimed = await tx.select().from(members).where(isNull(members.userId));
    const decision = await evaluateClaim({
      members: unclaimed,
      identifier,
      inviteSecret,
      verify: verifyPassword,
    });
    if (!decision.ok) {
      return { ok: false as const, error: claimErrorMessage(decision.reason) };
    }
    const member = decision.member;
    const [existingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.displayName, member.displayName))
      .limit(1);
    if (existingUser) {
      return { ok: false as const, error: "呢個名已有帳戶。請登入。" };
    }
    const [created] = await tx
      .insert(users)
      .values({
        displayName: member.displayName,
        email: member.email,
        passwordHash: await hashPassword(password),
      })
      .returning();
    await tx
      .update(members)
      .set({
        userId: created.id,
        inviteSecretHash: null,
        inviteExpiresAt: null,
      })
      .where(eq(members.id, member.id));
    return { ok: true as const, user: created };
  });

  if (!result.ok) {
    return { error: result.error };
  }
  await createSession(result.user.id);
  redirect("/");
}
