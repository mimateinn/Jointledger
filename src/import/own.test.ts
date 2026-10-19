import { describe, expect, it } from "vitest";
import { cashOwnForMember, resolveHolder, tradeOwnForAccount } from "./own";

describe("holder resolution", () => {
  it("maps v0.1.12 letter codes", () => {
    expect(resolveHolder("H", [])?.memberName).toBe("Hey");
    expect(resolveHolder("B", [])?.book).toBe("hey");
    expect(resolveHolder("F", [])?.book).toBe("joint");
    expect(resolveHolder("A", [])?.memberName).toBe("Sze");
    expect(resolveHolder("D", [])?.memberName).toBe("Wah");
  });

  it("recognises any listed ledger member by name", () => {
    const kit = resolveHolder("Kit", ["Hey", "Sze", "Kit"]);
    expect(kit).toEqual({
      own: "Kit",
      book: "personal",
      memberName: "Kit",
      role: "cash",
    });
    expect(resolveHolder("kit", ["Kit"])?.memberName).toBe("Kit");
  });

  it("does not default an unmatched name to Hey", () => {
    expect(resolveHolder("Ghost", ["Hey", "Sze", "Wah"])).toBeNull();
    expect(resolveHolder("K", ["Kit"])).toBeNull();
    expect(cashOwnForMember("Kit")).toBe("Kit");
    expect(cashOwnForMember("Kit")).not.toBe("H");
    expect(tradeOwnForAccount("personal", "Kit")).toBe("Kit");
    expect(tradeOwnForAccount("personal", "Kit")).not.toBe("B");
    expect(tradeOwnForAccount("personal", "Kit")).not.toBe("H");
  });
});
