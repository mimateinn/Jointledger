import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("delete actions route failures through humanFormError", () => {
  it("wraps holding, ledger, and member delete catches", () => {
    const entry = readFileSync(new URL("./entry.ts", import.meta.url), "utf8");
    expect(entry).toMatch(/export async function deleteHoldingAction[\s\S]*humanFormError\(/);
    expect(entry).toMatch(/export async function deleteLedgerEntryAction[\s\S]*humanFormError\(/);
    expect(entry).not.toMatch(
      /export async function deleteHoldingAction[\s\S]*return \{ error: error instanceof Error \? error\.message/,
    );
    const members = readFileSync(new URL("./members.ts", import.meta.url), "utf8");
    expect(members).toMatch(/export async function deleteMemberAction[\s\S]*humanFormError\(/);
  });
});
