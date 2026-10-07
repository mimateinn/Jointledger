import { describe, expect, it } from "vitest";
import { parseRowKind, rowKindLabel } from "./row-kind";

describe("import row kind", () => {
  it("parses buy, sell, split, adjustment, and dividend aliases", () => {
    expect(parseRowKind("買入")).toBe("buy");
    expect(parseRowKind("sell")).toBe("sell");
    expect(parseRowKind("拆股")).toBe("split");
    expect(parseRowKind("調整")).toBe("adjustment");
    expect(parseRowKind("股息")).toBe("adjustment");
    expect(parseRowKind("dividend")).toBe("adjustment");
    expect(parseRowKind("")).toBeNull();
  });

  it("labels known kinds in product copy", () => {
    expect(rowKindLabel("split")).toBe("拆股");
    expect(rowKindLabel("adjustment")).toBe("調整");
  });
});
