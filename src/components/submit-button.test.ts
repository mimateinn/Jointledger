import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("immediate click feedback", () => {
  it("submit buttons disable on form pending", () => {
    const button = readFileSync("src/components/submit-button.tsx", "utf8");
    expect(button).toMatch(/useFormStatus/);
    expect(button).toMatch(/disabled=\{pending\}/);
  });

  it("create account, entry, and nav use instant feedback", () => {
    const login = readFileSync("src/app/(auth)/login/login-form.tsx", "utf8");
    const entry = readFileSync("src/app/(app)/entry/entry-form.tsx", "utf8");
    const firstUse = readFileSync("src/app/(app)/first-use/first-use-form.tsx", "utf8");
    const chrome = readFileSync("src/components/app-chrome.tsx", "utf8");
    expect(login).toMatch(/SubmitButton/);
    expect(entry).toMatch(/SubmitButton/);
    expect(firstUse).toMatch(/SubmitButton/);
    expect(chrome).toMatch(/router\.prefetch/);
    expect(chrome).toMatch(/prefetch/);
    expect(chrome).toMatch(/setPendingHref/);
  });
});
