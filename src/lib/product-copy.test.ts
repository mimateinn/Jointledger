import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product copy", () => {
  it("uses 資產淨值 and 未有報價, never 未有現價", () => {
    const overview = readFileSync("src/app/(app)/overview/overview-client.tsx", "utf8");
    const holdings = readFileSync("src/components/holdings-workspace.tsx", "utf8");
    expect(overview).toContain("資產淨值");
    expect(overview).toContain("未有報價");
    expect(holdings).toContain("未有報價");
    expect(overview).not.toContain("未有現價");
    expect(holdings).not.toContain("未有現價");
  });

  it("empty product pages have one next-step button", () => {
    const overview = readFileSync("src/app/(app)/overview/overview-client.tsx", "utf8");
    const holdings = readFileSync("src/components/holdings-workspace.tsx", "utf8");
    const returns = readFileSync("src/app/(app)/returns/returns-client.tsx", "utf8");
    const ledger = readFileSync("src/app/(app)/ledger/ledger-client.tsx", "utf8");
    const watch = readFileSync("src/components/watchlist-panel.tsx", "utf8");
    expect(overview).toContain("未有入金，記一筆就可以開始。");
    expect(overview).toMatch(/btn-primary[\s\S]*入金/);
    expect(holdings).toContain("未有持倉，記一筆就可以加倉。");
    expect(returns).toContain("未有流水，收益率暫時無得計。");
    expect(ledger).toContain("未有出入金或買賣。");
    expect(watch).toContain("未有關注，加入代碼或先去加持倉。");
  });

  it("deletes require confirm with 取消", () => {
    const holding = readFileSync("src/components/holding-delete.tsx", "utf8");
    const member = readFileSync("src/components/member-delete.tsx", "utf8");
    expect(holding).toContain("role=\"dialog\"");
    expect(holding).toContain("取消");
    expect(member).toContain("role=\"dialog\"");
    expect(member).toContain("取消");
  });

  it("entry stays on the page and shows a success hint", () => {
    const actions = readFileSync("src/app/actions/entry.ts", "utf8");
    const form = readFileSync("src/app/(app)/entry/entry-form.tsx", "utf8");
    expect(actions).toContain('ok: "已記入入金"');
    expect(actions).toContain('ok: "已記入加倉"');
    expect(actions).not.toMatch(/redirect\(/);
    expect(form).toContain('role="status"');
  });
});
