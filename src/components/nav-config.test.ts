import { describe, expect, it } from "vitest";
import { desktopNav } from "./nav-config";

describe("sidebar", () => {
  it("stays at six items and does not list 關注", () => {
    expect(desktopNav.map((item) => item.label)).toEqual([
      "總覽",
      "持倉",
      "記一筆",
      "收益率",
      "流水",
      "帳戶",
    ]);
    expect(desktopNav).toHaveLength(6);
    expect(desktopNav.map((item) => item.label).join(" ")).not.toContain("關注");
  });
});
