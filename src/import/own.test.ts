import { describe, expect, it } from "vitest";
import {
  cashOwnForMember,
  isLegacyHeySzeHolder,
  jointHolderToken,
  resolveHolder,
  tradeOwnForAccount,
  type ResolvedHolder,
} from "./own";

function holder(raw: string, known: readonly string[] = []): ResolvedHolder | null {
  const resolved = resolveHolder(raw, known);
  return resolved.ok ? resolved.holder : null;
}

describe("holder resolution", () => {
  it("maps v0.1.12 letter codes", () => {
    expect(holder("H")?.memberName).toBe("Hey");
    expect(holder("B")?.book).toBe("hey");
    expect(holder("F")?.book).toBe("joint");
    expect(holder("A")?.memberName).toBe("Sze");
    expect(holder("D")?.memberName).toBe("Wah");
    expect(holder("聯名（Hey + Sze）")?.book).toBe("joint");
    expect(isLegacyHeySzeHolder("聯名（Hey + Sze）")).toBe(true);
    expect(isLegacyHeySzeHolder("F")).toBe(false);
  });

  it("recognises any listed ledger member by name", () => {
    const kit = holder("Kit", ["Hey", "Sze", "Kit"]);
    expect(kit).toEqual({
      own: "Kit",
      book: "personal",
      memberName: "Kit",
      role: "cash",
    });
    expect(holder("kit", ["Kit"])?.memberName).toBe("Kit");
  });

  it("matches exact member names before letter codes and joint aliases", () => {
    expect(holder("B", ["B", "F"])?.memberName).toBe("B");
    expect(holder("B", ["B", "F"])?.book).not.toBe("hey");
    expect(holder("F", ["B", "F"])?.memberName).toBe("F");
    expect(holder("F", ["B", "F"])?.book).not.toBe("joint");
    expect(holder("Joint", ["Joint"])?.memberName).toBe("Joint");
    expect(holder("聯名", ["聯名"])?.memberName).toBe("聯名");
    expect(holder("明", ["明"])?.memberName).toBe("明");
    expect(holder("K", ["K"])?.memberName).toBe("K");
  });

  it("does not default an unmatched or empty name to Hey", () => {
    expect(resolveHolder("Ghost", ["Hey", "Sze", "Wah"])).toEqual({ ok: false, reason: "unknown" });
    expect(resolveHolder("K", ["Kit"])).toEqual({ ok: false, reason: "unknown" });
    expect(resolveHolder("", ["Hey"])).toEqual({ ok: false, reason: "empty" });
    expect(resolveHolder("   ", [])).toEqual({ ok: false, reason: "empty" });
    expect(cashOwnForMember("Kit")).toBe("Kit");
    expect(cashOwnForMember("Kit")).not.toBe("H");
    expect(tradeOwnForAccount("personal", "Kit")).toBe("Kit");
    expect(tradeOwnForAccount("personal", "Kit")).not.toBe("B");
    expect(tradeOwnForAccount("personal", "Kit")).not.toBe("H");
  });

  it("picks a joint token that does not collide with member names", () => {
    expect(jointHolderToken(["Hey", "Sze"])).toBe("F");
    expect(jointHolderToken(["B", "F", "K", "明", "Joint", "聯名"])).toBe("聯名倉");
  });

  it("errors when a holder is genuinely ambiguous", () => {
    expect(resolveHolder("KIT", ["Kit", "kit"])).toEqual({ ok: false, reason: "ambiguous" });
    expect(resolveHolder("Kit", ["Kit", "Kit"])).toEqual({ ok: false, reason: "ambiguous" });
  });
});
