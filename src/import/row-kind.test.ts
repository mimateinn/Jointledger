import { describe, expect, it } from "vitest";
import { exportRowKind, isDividendKindRaw, parseRowKind, rowKindLabel } from "./row-kind";

describe("import row kind", () => {
  it("parses buy, sell, split, adjustment, and dividend aliases", () => {
    expect(parseRowKind("買入")).toBe("buy");
    expect(parseRowKind("sell")).toBe("sell");
    expect(parseRowKind("拆股")).toBe("split");
    expect(parseRowKind("adjustment")).toBe("adjustment");
    expect(parseRowKind("調整")).toBe("adjustment");
    expect(parseRowKind("股息")).toBe("adjustment");
    expect(parseRowKind("dividend")).toBe("adjustment");
    expect(parseRowKind("")).toBeNull();
  });

  it("labels known kinds in product copy", () => {
    expect(rowKindLabel("split")).toBe("拆股");
    expect(rowKindLabel("adjustment")).toBe("調整");
  });

  it("exports a dividend token only when the adjustment note is 股息", () => {
    expect(exportRowKind("adjustment", "股息 MSFT")).toBe("dividend");
    expect(exportRowKind("adjustment", "股息")).toBe("dividend");
    expect(exportRowKind("adjustment", "rounding")).toBe("adjustment");
    expect(exportRowKind("buy", "股息 leftover")).toBe("buy");
    expect(isDividendKindRaw("dividend")).toBe(true);
    expect(isDividendKindRaw("股息")).toBe(true);
    expect(isDividendKindRaw("adjustment")).toBe(false);
    expect(isDividendKindRaw("調整")).toBe(false);
  });
});
