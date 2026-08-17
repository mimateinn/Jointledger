import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateClaim, matchClaimableMember } from "./claim";
import { mintInviteSecret } from "./invite";
import { hashPassword, verifyPassword } from "./password";

const now = new Date("2026-08-17T00:00:00Z");

function members() {
  return [
    {
      id: "1",
      displayName: "Hey",
      email: "hey@x.com",
      userId: "u1",
      inviteSecretHash: null,
      inviteExpiresAt: null,
    },
    {
      id: "2",
      displayName: "Sze",
      email: "sze@x.com",
      userId: null,
      inviteSecretHash: "h:correct-secret",
      inviteExpiresAt: new Date("2026-08-20T00:00:00Z"),
    },
    {
      id: "3",
      displayName: "Wah",
      email: null,
      userId: null,
      inviteSecretHash: "h:wah-secret",
      inviteExpiresAt: new Date("2026-08-20T00:00:00Z"),
    },
  ];
}

async function verify(hash: string, secret: string) {
  return hash === `h:${secret}`;
}

describe("claim", () => {
  it("treats name and email as identifiers only, not a capability", () => {
    const rows = members();
    expect(matchClaimableMember(rows, "Sze")?.id).toBe("2");
    expect(matchClaimableMember(rows, "sze@x.com")?.id).toBe("2");
    expect(matchClaimableMember(rows, "Hey")).toBeNull();
  });

  it("fails without a secret even when the name matches", async () => {
    const decision = await evaluateClaim({
      members: members(),
      identifier: "Sze",
      inviteSecret: "",
      now,
      verify,
    });
    expect(decision).toEqual({ ok: false, reason: "no_secret" });
  });

  it("fails with the wrong secret", async () => {
    const decision = await evaluateClaim({
      members: members(),
      identifier: "Sze",
      inviteSecret: "wrong-secret",
      now,
      verify,
    });
    expect(decision).toEqual({ ok: false, reason: "wrong_secret" });
  });

  it("fails when the secret is expired", async () => {
    const decision = await evaluateClaim({
      members: members(),
      identifier: "Sze",
      inviteSecret: "correct-secret",
      now: new Date("2026-08-21T00:00:00Z"),
      verify,
    });
    expect(decision).toEqual({ ok: false, reason: "expired" });
  });

  it("fails when the secret was already used or never issued", async () => {
    const used = members().map((row) =>
      row.id === "2" ? { ...row, inviteSecretHash: null, inviteExpiresAt: null } : row,
    );
    const decision = await evaluateClaim({
      members: used,
      identifier: "Sze",
      inviteSecret: "correct-secret",
      now,
      verify,
    });
    expect(decision).toEqual({ ok: false, reason: "used" });
  });

  it("correct secret binds only that member", async () => {
    const decision = await evaluateClaim({
      members: members(),
      identifier: "Sze",
      inviteSecret: "correct-secret",
      now,
      verify,
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.member.id).toBe("2");
      expect(decision.member.displayName).toBe("Sze");
      expect(decision.member.id).not.toBe("3");
    }
    const wah = await evaluateClaim({
      members: members(),
      identifier: "Wah",
      inviteSecret: "correct-secret",
      now,
      verify,
    });
    expect(wah).toEqual({ ok: false, reason: "wrong_secret" });
  });

  it("name or email alone cannot claim", async () => {
    for (const identifier of ["Sze", "sze@x.com"]) {
      const decision = await evaluateClaim({
        members: members(),
        identifier,
        inviteSecret: "   ",
        now,
        verify,
      });
      expect(decision.ok).toBe(false);
      if (!decision.ok) {
        expect(decision.reason).toBe("no_secret");
      }
    }
  });

  it("stores only a hash: plaintext mint verifies with argon2id and is not a shared passphrase", async () => {
    const secret = mintInviteSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const hashed = await hashPassword(secret);
    expect(hashed).not.toContain(secret);
    expect(await verifyPassword(hashed, secret)).toBe(true);
    expect(await verifyPassword(hashed, "other")).toBe(false);
  });

  it("does not open a book from the claim action and requires the invite field", () => {
    const text = readFileSync(join(process.cwd(), "src/app/actions/auth.ts"), "utf8");
    const claim = text.slice(text.indexOf("export async function claimAction"));
    expect(claim).toContain("inviteSecret");
    expect(claim).toContain("evaluateClaim");
    expect(claim).not.toMatch(/createBook/);
    expect(claim).not.toMatch(/first-use/);
    expect(claim).toContain('redirect("/")');
  });
});
