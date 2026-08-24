import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { preparePasswordChange } from "./change-password";
import { hashPassword, verifyPassword } from "./password";

describe("change password", () => {
  it("replaces the hash on the happy path", async () => {
    const current = await hashPassword("old-pass-1");
    const result = await preparePasswordChange(current, {
      currentPassword: "old-pass-1",
      newPassword: "new-pass-9",
      confirmPassword: "new-pass-9",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.nextHash).not.toBe(current);
    expect(await verifyPassword(result.nextHash, "new-pass-9")).toBe(true);
    expect(await verifyPassword(result.nextHash, "old-pass-1")).toBe(false);
    expect(await verifyPassword(current, "old-pass-1")).toBe(true);
  });

  it("rejects the wrong current password and does not hash a replacement", async () => {
    const current = await hashPassword("old-pass-1");
    const result = await preparePasswordChange(current, {
      currentPassword: "nope-nope",
      newPassword: "new-pass-9",
      confirmPassword: "new-pass-9",
    });
    expect(result).toEqual({ ok: false, error: "而家嘅密碼不正確" });
  });

  it("rejects a new password shorter than 8 and does not write", async () => {
    const current = await hashPassword("old-pass-1");
    const result = await preparePasswordChange(current, {
      currentPassword: "old-pass-1",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result).toEqual({ ok: false, error: "密碼至少 8 個字" });
  });

  it("rejects a confirm mismatch without writing", async () => {
    const current = await hashPassword("old-pass-1");
    const result = await preparePasswordChange(current, {
      currentPassword: "old-pass-1",
      newPassword: "new-pass-9",
      confirmPassword: "new-pass-8",
    });
    expect(result).toEqual({ ok: false, error: "兩次新密碼唔一致" });
  });

  it("account action reuses argon2 helpers and does not touch claim or sessions", () => {
    const action = readFileSync(join(process.cwd(), "src/app/actions/auth.ts"), "utf8");
    const change = action.slice(action.indexOf("export async function changePasswordAction"));
    expect(change).toContain("preparePasswordChange");
    expect(change).toContain("passwordHash");
    expect(change).not.toMatch(/createSession|destroySession|evaluateClaim|inviteSecret|createBook/);
    expect(change).not.toMatch(/gmail\.com/);
  });
});
