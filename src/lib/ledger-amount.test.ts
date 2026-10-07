import { describe, expect, it } from "vitest";
import { formatLedgerTradeAmount, formatLedgerTradePrice, ledgerRowAmountUsd } from "./ledger-amount";

describe("ledgerRowAmountUsd", () => {
  const row = {
    amountUsd: "100.00000000",
    memberAmounts: [
      { memberId: "mem-a", amountUsd: "60.00000000" },
      { memberId: "mem-b", amountUsd: "40.00000000" },
    ],
  };

  it("shows the dividend total, and each member share when filtered", () => {
    expect(ledgerRowAmountUsd(row, "")).toBe("100.00000000");
    expect(ledgerRowAmountUsd(row, "joint")).toBe("100.00000000");
    expect(ledgerRowAmountUsd(row, "mem-a")).toBe("60.00000000");
    expect(ledgerRowAmountUsd(row, "mem-b")).toBe("40.00000000");
  });

  it("formats adjustment / dividend amounts as signed USD", () => {
    expect(formatLedgerTradeAmount("adjustment", "100")).toBe("+US$ 100.00");
    expect(formatLedgerTradeAmount("adjustment", "2.50")).toBe("+US$ 2.50");
    expect(formatLedgerTradeAmount("adjustment", "-5")).toBe("-US$ 5.00");
    expect(formatLedgerTradeAmount("buy", "500")).toBe("US$ 500.00");
  });

  it("shows an em dash instead of US$ 0.00 for dividend / adjustment prices", () => {
    expect(formatLedgerTradePrice("adjustment", "0")).toBe("—");
    expect(formatLedgerTradePrice("adjustment", "0.00000000")).toBe("—");
    expect(formatLedgerTradePrice("buy", "50")).toBe("US$ 50.00");
    expect(formatLedgerTradePrice("split", "2")).toBe("US$ 2.00");
  });
});
