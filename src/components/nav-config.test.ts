import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { desktopNav, mobileNav } from "./nav-config";

const six = ["總覽", "持倉", "記一筆", "收益率", "流水", "帳戶"];

describe("sidebar", () => {
  it("stays at six items and does not list 關注", () => {
    expect(desktopNav.map((item) => item.label)).toEqual(six);
    expect(desktopNav).toHaveLength(6);
    expect(desktopNav.map((item) => item.label).join(" ")).not.toContain("關注");
  });

  it("bottom nav has the same six enterable items", () => {
    expect(mobileNav.map((item) => item.label)).toEqual(six);
    expect(mobileNav).toHaveLength(6);
  });

  it("does not disable nav when holdings are empty", () => {
    const chrome = readFileSync("src/components/app-chrome.tsx", "utf8");
    const config = readFileSync("src/components/nav-config.ts", "utf8");
    expect(chrome).not.toMatch(/holdings\.length/);
    expect(chrome).not.toMatch(/disabled/);
    expect(config).not.toMatch(/holdings\.length/);
    expect(config).not.toMatch(/disabled/);
  });
});
