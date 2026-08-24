import { hashPassword, verifyPassword } from "./password";

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordChangeResult =
  | { ok: true; nextHash: string }
  | { ok: false; error: string };

export async function preparePasswordChange(
  currentHash: string | null | undefined,
  input: PasswordChangeInput,
): Promise<PasswordChangeResult> {
  if (input.newPassword.length < 8) {
    return { ok: false, error: "密碼至少 8 個字" };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, error: "兩次新密碼唔一致" };
  }
  if (!currentHash || !(await verifyPassword(currentHash, input.currentPassword))) {
    return { ok: false, error: "而家嘅密碼不正確" };
  }
  return { ok: true, nextHash: await hashPassword(input.newPassword) };
}
