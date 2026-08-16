import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { SESSION_COOKIE } from "./cookie";

export { SESSION_COOKIE };
export const INVALIDATE_SESSION_PATH = "/api/auth/invalidate";

const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  displayName: string;
  email: string | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

function clearSessionCookie(jar: Awaited<ReturnType<typeof cookies>>): void {
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const db = getDb();
      await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    } catch {
      // Row or table may already be gone (expired session, wiped DB).
    }
  }
  clearSessionCookie(jar);
}

type SessionInspection =
  | { status: "none" }
  | { status: "valid"; user: SessionUser }
  | { status: "stale" };

async function inspectSession(): Promise<SessionInspection> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return { status: "none" };
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, hashToken(token)))
      .limit(1);

    if (!row || row.expiresAt.getTime() < Date.now()) {
      return { status: "stale" };
    }
    return {
      status: "valid",
      user: { id: row.id, displayName: row.displayName, email: row.email },
    };
  } catch {
    return { status: "stale" };
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await inspectSession();
  if (session.status === "none") {
    return null;
  }
  if (session.status === "stale") {
    redirect(INVALIDATE_SESSION_PATH);
  }
  return session.user;
}

/** GET invalidate: drop a missing/expired cookie only. Live sessions stay put. */
export async function clearStaleSession(): Promise<"cleared" | "kept"> {
  const session = await inspectSession();
  if (session.status === "valid") {
    return "kept";
  }
  await destroySession();
  return "cleared";
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("未登入");
  }
  return user;
}
