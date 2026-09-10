import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inviteSecretFieldName } from "@/import/invite-secrets";
import { persistInvite } from "./invite-persist";
import { mintInviteSecret } from "./invite";
import { verifyPassword } from "./password";

describe("invite persist", () => {
  it("stores hash + expiry and never the plaintext secret", async () => {
    const secret = mintInviteSecret();
    const fields = await persistInvite(secret, new Date("2026-08-17T00:00:00Z"));
    expect(fields.inviteSecretHash).not.toContain(secret);
    expect(fields.inviteSecretHash.length).toBeGreaterThan(20);
    expect(fields.inviteExpiresAt.toISOString()).toBe("2026-08-24T00:00:00.000Z");
    expect(await verifyPassword(fields.inviteSecretHash, secret)).toBe(true);
    expect(await verifyPassword(fields.inviteSecretHash, "other")).toBe(false);
  });

  it("import field names are inviteSecret-<name>", () => {
    expect(inviteSecretFieldName("Sze")).toBe("inviteSecret-Sze");
    expect(inviteSecretFieldName("小明")).toBe("inviteSecret-小明");
  });

  it("import action and members writeInvite; no plaintext in draft or logs", () => {
    const persist = readFileSync(join(process.cwd(), "src/auth/invite-persist.ts"), "utf8");
    expect(persist).toContain("hashPassword");
    expect(persist).toContain("inviteExpiry");
    expect(persist).toContain("export async function writeInvite");

    const importAction = readFileSync(join(process.cwd(), "src/app/actions/import.ts"), "utf8");
    expect(importAction).toContain("writeInvite");
    expect(importAction).toContain("issuedInvites");
    expect(importAction).toContain("readInviteSecret");
    expect(importAction).not.toMatch(/rowLog:.*inviteSecret/);
    expect(importAction).not.toMatch(/plan:.*inviteSecret/);

    const members = readFileSync(join(process.cwd(), "src/app/actions/members.ts"), "utf8");
    expect(members).toContain("writeInvite");

    const wizard = readFileSync(join(process.cwd(), "src/app/(app)/first-use/import-wizard.tsx"), "utf8");
    expect(wizard).toContain("inviteSecretFieldName");
    expect(wizard).toContain("issuedInvites");
    expect(wizard).toContain("只顯示一次");
  });
});
