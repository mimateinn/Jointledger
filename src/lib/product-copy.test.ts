import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product copy", () => {
  it("uses 資產淨值 and never 未有現價; no market price uses buy cost", () => {
    const overview = readFileSync("src/app/(app)/overview/overview-client.tsx", "utf8");
    const holdings = readFileSync("src/components/holdings-workspace.tsx", "utf8");
    const watch = readFileSync("src/components/watchlist-panel.tsx", "utf8");
    const kline = readFileSync("src/components/instrument-kline.tsx", "utf8");
    expect(overview).toContain("資產淨值");
    expect(overview).toContain("可用資金");
    expect(overview).toContain("todayChangeLabel");
    expect(overview).not.toContain('percentChange ?? "—"');
    expect(holdings).toContain("暫時用買入價，未有市場價");
    expect(watch).toContain("未有報價");
    expect(kline).toContain("未有報價");
    expect(overview).not.toContain("未有現價");
    expect(holdings).not.toContain("未有現價");
    expect(watch).not.toContain("未有現價");
    expect(kline).not.toContain("未有現價");
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

  it("deletes require confirm with 取消, state consequence, and undo", () => {
    const holding = readFileSync("src/components/holding-delete.tsx", "utf8");
    const member = readFileSync("src/components/member-delete.tsx", "utf8");
    expect(holding).toContain("role=\"dialog\"");
    expect(holding).toContain("取消");
    expect(holding).toContain("同相關賣出會一齊消失");
    expect(holding).toContain("還原");
    expect(member).toContain("role=\"dialog\"");
    expect(member).toContain("取消");
    expect(member).toContain("持倉同流水會一齊消失");
    expect(member).toContain("還原");
  });

  it("entry stays on the page and shows a success hint", () => {
    const actions = readFileSync("src/app/actions/entry.ts", "utf8");
    const form = readFileSync("src/app/(app)/entry/entry-form.tsx", "utf8");
    expect(actions).toContain('ok: "已記入入金"');
    expect(actions).toContain('ok: "已記入加倉"');
    expect(actions).not.toMatch(/redirect\(/);
    expect(form).toContain('role="status"');
  });

  it("primary buttons show 儲存中 and money uses formatUsd", () => {
    const button = readFileSync("src/components/submit-button.tsx", "utf8");
    const entry = readFileSync("src/app/(app)/entry/entry-form.tsx", "utf8");
    const overview = readFileSync("src/app/(app)/overview/overview-client.tsx", "utf8");
    expect(button).toContain('pendingLabel = "儲存中"');
    expect(entry).toContain('pendingLabel="儲存中"');
    expect(overview).toContain("formatUsd");
    expect(overview).toContain("US$ 0.00");
  });

  it("account reads like settings and titles follow the page", () => {
    const account = readFileSync("src/app/(app)/account/account-client.tsx", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const overview = readFileSync("src/app/(app)/overview/page.tsx", "utf8");
    const entry = readFileSync("src/app/(app)/entry/page.tsx", "utf8");
    const holdings = readFileSync("src/app/(app)/holdings/page.tsx", "utf8");
    const returns = readFileSync("src/app/(app)/returns/page.tsx", "utf8");
    const ledger = readFileSync("src/app/(app)/ledger/page.tsx", "utf8");
    const accountPage = readFileSync("src/app/(app)/account/page.tsx", "utf8");
    expect(account).toContain("我是誰");
    expect(account).toContain("其他人");
    expect(account).toContain("登出");
    expect(layout).toContain('icon: "/icon.png"');
    expect(layout).toContain('template: "%s · 聯倉"');
    expect(overview).toContain('title: "總覽"');
    expect(entry).toContain('title: "記一筆"');
    expect(holdings).toContain('title: "持倉"');
    expect(returns).toContain('title: "收益率"');
    expect(ledger).toContain('title: "流水"');
    expect(accountPage).toContain('title: "帳戶"');
  });

  it("NAV has 截至, empty kline has a sentence, nav current is marked", () => {
    const overview = readFileSync("src/app/(app)/overview/overview-client.tsx", "utf8");
    const kline = readFileSync("src/components/kline-chart.tsx", "utf8");
    const chrome = readFileSync("src/components/app-chrome.tsx", "utf8");
    const css = readFileSync("src/app/globals.css", "utf8");
    const loading = readFileSync("src/app/(app)/loading.tsx", "utf8");
    const errorPage = readFileSync("src/app/(app)/error.tsx", "utf8");
    expect(overview).toContain("asOfLabel");
    expect(kline).toContain("未有日線");
    expect(kline).toContain("這檔還沒有可畫的區間");
    expect(chrome).toContain('aria-current={active ? "page"');
    expect(css).toContain("nav-item-active");
    expect(css).toContain("skeleton");
    expect(css).toContain("tabular-nums");
    expect(loading).toContain("skeleton");
    expect(errorPage).toContain("再試");
    expect(errorPage).not.toContain("error.message");
  });

  it("applies the screen copy and chrome fixes", () => {
    const overview = readFileSync("src/app/(app)/overview/overview-client.tsx", "utf8");
    const entry = readFileSync("src/app/(app)/entry/entry-form.tsx", "utf8");
    const holdingsPage = readFileSync("src/app/(app)/holdings/page.tsx", "utf8");
    const holdings = readFileSync("src/components/holdings-workspace.tsx", "utf8");
    const watch = readFileSync("src/components/watchlist-panel.tsx", "utf8");
    const kline = readFileSync("src/components/instrument-kline.tsx", "utf8");
    const chrome = readFileSync("src/components/app-chrome.tsx", "utf8");
    const account = readFileSync("src/app/(app)/account/account-client.tsx", "utf8");
    const tape = readFileSync("src/components/ticker-tape.tsx", "utf8");
    expect(overview).toContain('h1 className="title"');
    expect(overview).not.toContain('h1 className="display"');
    expect(overview).toContain("邊個倉");
    expect(overview).toContain("未計持股");
    expect(overview).not.toContain("記落邊個人");
    expect(overview).not.toContain("未計持倉");
    expect(overview).toContain("formatQty");
    expect(overview).not.toContain("byMember.map");
    expect(entry).toContain("邊個倉");
    expect(entry).not.toContain("記落邊個人");
    expect(holdingsPage).not.toContain("部分市值");
    expect(holdings).toContain("tab === \"holdings\" && partialNav");
    expect(watch).toContain("未有關注，加入代碼或先去加持倉。");
    expect(watch).not.toContain("chip-delay");
    expect(kline).not.toContain("都當 Instrument");
    expect(kline).toContain("instrument-last");
    expect(kline).toContain("今日");
    expect(kline).toContain("todayChangeLabel");
    expect(kline).not.toContain("DelayBadge");
    expect(readFileSync("src/app/(app)/instrument/[code]/page.tsx", "utf8")).toContain("containInShell");
    expect(readFileSync("src/app/(app)/layout.tsx", "utf8")).toContain("AppChrome");
    expect(kline).toContain("canChart ? <IndicatorPicker");
    expect(readFileSync("src/components/kline-chart.tsx", "utf8")).toContain("這檔還沒有可畫的區間");
    expect(readFileSync("next.config.ts", "utf8")).toContain("devIndicators: false");
    expect(chrome).not.toContain("ThemeToggle");
    expect(chrome).not.toContain("暖紙白");
    expect(readFileSync("src/app/(auth)/login/login-form.tsx", "utf8")).not.toContain("ThemeToggle");
    expect(account).toContain("設定");
    expect(account).toContain("ThemeToggle");
    expect(account).toContain("暖紙白");
    expect(tape).toContain("tape-symbol");
    expect(tape).toContain("tape-lead");
    expect(overview).not.toContain("延遲 15 分");
    expect(holdings).not.toContain("延遲 15 分");
    expect(watch).not.toContain("延遲 15 分");
    expect(kline).not.toContain("延遲 15 分");
  });
});
