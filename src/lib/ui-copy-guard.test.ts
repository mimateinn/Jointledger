import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const UI_FILES = [
  "src/components/update-check-button.tsx",
  "src/app/(auth)/login/login-form.tsx",
  "src/app/(app)/account/account-client.tsx",
  "src/app/(app)/overview/overview-client.tsx",
  "src/app/(app)/ledger/ledger-client.tsx",
  "src/app/(app)/entry/entry-form.tsx",
  "src/components/first-run-tips.tsx",
  "src/components/ledger-entry-delete.tsx",
];

describe("product UI copy", () => {
  it("does not show contact emails or demo usernames", () => {
    for (const file of UI_FILES) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
      expect(text, file).not.toContain("小明");
      expect(text, file).not.toContain("demo@");
    }
  });

  it("keeps login-required update copy without developer wording", () => {
    const text = readFileSync("src/components/update-check-button.tsx", "utf8");
    expect(text).toContain("請先登入再檢查更新");
    expect(text).not.toContain(".env");
    expect(text).not.toContain("HTTP ");
  });
});
