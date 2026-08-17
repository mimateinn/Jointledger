import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { matchClaimableMember } from "./claim";

describe("claim", () => {
  it("binds an unclaimed member by display name or email and ignores claimed rows", () => {
    const members = [
      { id: "1", displayName: "Hey", email: "hey@x.com", userId: "u1" },
      { id: "2", displayName: "Sze", email: "sze@x.com", userId: null },
      { id: "3", displayName: "Wah", email: null, userId: null },
    ];
    expect(matchClaimableMember(members, "Sze")?.id).toBe("2");
    expect(matchClaimableMember(members, "sze@x.com")?.id).toBe("2");
    expect(matchClaimableMember(members, "Hey")).toBeNull();
    expect(matchClaimableMember(members, "nobody")).toBeNull();
  });

  it("does not open a book from the claim action", () => {
    const text = readFileSync(join(process.cwd(), "src/app/actions/auth.ts"), "utf8");
    const claim = text.slice(text.indexOf("export async function claimAction"));
    expect(claim).toContain("claimAction");
    expect(claim).not.toMatch(/createBook/);
    expect(claim).not.toMatch(/first-use/);
    expect(claim).toContain('redirect("/")');
  });
});
