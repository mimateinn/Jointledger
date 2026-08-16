"use server";

import { count, eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/auth/session";
import { hashPassword, verifyPassword } from "@/auth/password";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

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
  const db = getDb();

  // Serialize first-user signup: a count check alone races when the table is empty
  // (FOR UPDATE locks zero rows). Advisory lock + re-check inside one transaction.
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(87241001)`);
    const [existing] = await tx.select({ n: count() }).from(users);
    if (Number(existing?.n ?? 0) > 0) {
      return { ok: false as const };
    }
    const [created] = await tx
      .insert(users)
      .values({ displayName, email, passwordHash })
      .returning();
    return { ok: true as const, user: created };
  });

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
