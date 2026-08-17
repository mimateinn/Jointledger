import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pages = [
  "src/app/(app)/overview/page.tsx",
  "src/app/(app)/holdings/page.tsx",
  "src/app/(app)/entry/page.tsx",
  "src/app/(app)/returns/page.tsx",
  "src/app/(app)/ledger/page.tsx",
  "src/app/(app)/account/page.tsx",
];

describe("empty book nav unlock", () => {
  it("six feature pages ensure a book instead of gating on holdings", () => {
    for (const path of pages) {
      const src = readFileSync(path, "utf8");
      expect(src).toContain("ensureCurrentBook");
      expect(src).not.toMatch(/holdings\.length\s*===\s*0/);
    }
  });

  it("empty states offer 記一筆 or 加持倉", () => {
    const holdings = readFileSync("src/components/holdings-workspace.tsx", "utf8");
    const returns = readFileSync("src/app/(app)/returns/returns-client.tsx", "utf8");
    const ledger = readFileSync("src/app/(app)/ledger/ledger-client.tsx", "utf8");
    const account = readFileSync("src/app/(app)/account/account-client.tsx", "utf8");
    expect(holdings).toContain("加持倉");
    expect(returns).toContain("EmptyPanel");
    expect(ledger).toContain("EmptyPanel");
    expect(account).toContain("EmptyPanel");
  });
});
