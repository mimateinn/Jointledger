import { describe, expect, it } from "vitest";
import { jointShareFraction } from "@/ledger/summary";
import { formatSharePercent } from "./format";
import { lotRowKey } from "./lot-row-key";
import { memberLabel } from "./member-label";

describe("memberLabel", () => {
  it("uses 未認領 when there is no member and no memberId", () => {
    expect(memberLabel(null)).toBe("未認領");
    expect(memberLabel(undefined, null)).toBe("未認領");
  });

  it("uses 已退出 when memberId is set but the member is gone", () => {
    expect(memberLabel(null, "gone-id")).toBe("已退出");
  });

  it("uses the display name when the member exists", () => {
    expect(memberLabel({ displayName: "小明" })).toBe("小明");
    expect(memberLabel({ displayName: "小明" }, "m1")).toBe("小明");
  });
});

describe("lot-row-key", () => {
  it("uses tradeId:_ when memberId is null", () => {
    expect(lotRowKey({ tradeId: "t1", memberId: null })).toBe("t1:_");
    expect(lotRowKey({ tradeId: "t1" })).toBe("t1:_");
    expect(lotRowKey({ tradeId: "t1", memberId: "m1" })).toBe("t1:m1");
  });
});

describe("jointShareFraction", () => {
  it("returns the member quantity over the joint trade", () => {
    const share = jointShareFraction(
      [
        { tradeId: "t", memberId: "a", quantity: "4" },
        { tradeId: "t", memberId: "b", quantity: "6" },
      ],
      "t",
      "a",
    );
    expect(share).not.toBeNull();
    expect(formatSharePercent(share)).toBe("40.0%");
    expect(jointShareFraction([{ tradeId: "t", memberId: "a", quantity: "4" }], "t", "a")).toBeNull();
    expect(jointShareFraction(
      [
        { tradeId: "t", memberId: "a", quantity: "4" },
        { tradeId: "t", memberId: "b", quantity: "6" },
      ],
      "t",
      null,
    )).toBeNull();
  });
});
