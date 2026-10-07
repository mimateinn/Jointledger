import { describe, expect, it } from "vitest";
import { humanFormError } from "./human-error";

describe("humanFormError", () => {
  it("maps domain throws to one human sentence", () => {
    expect(humanFormError("數量必須大於 0")).toBe("數量不能是零");
    expect(humanFormError("要寫代碼")).toBe("未選標的");
    expect(humanFormError("金額必須大於 0")).toBe("金額不能是零");
    expect(humanFormError("這代碼未有報價")).toBe("這檔未有報價");
    expect(humanFormError("拆股新股必須大於 0")).toBe("拆股比例不能是零");
    expect(humanFormError("調整要寫備註")).toBe("調整要寫備註");
    expect(
      humanFormError("SQLITE_BUSY: INSERT INTO cash_flows (id) VALUES ('550e8400-e29b-41d4-a716-446655440000')"),
    ).toBe("儲存失敗");
  });
});
