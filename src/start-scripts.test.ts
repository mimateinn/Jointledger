import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("start scripts", () => {
  const sh = readFileSync("start.sh", "utf8");
  const bat = readFileSync("start.bat", "utf8");

  it("defaults to production build+start with JL_DEV escape hatch", () => {
    expect(sh).toMatch(/JL_DEV/);
    expect(sh).toMatch(/pnpm build/);
    expect(sh).toMatch(/pnpm start/);
    expect(sh.indexOf("pnpm dev")).toBeGreaterThan(sh.indexOf("JL_DEV"));
    expect(bat).toMatch(/JL_DEV/);
    expect(bat).toMatch(/pnpm build/);
    expect(bat).toMatch(/pnpm start/);
    expect(bat.indexOf("pnpm dev")).toBeGreaterThan(bat.indexOf("JL_DEV"));
  });

  it("does not start Docker or probe 5432", () => {
    const shCode = sh
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(shCode).not.toMatch(/docker/i);
    expect(shCode).not.toMatch(/5432/);
    expect(bat).not.toMatch(/docker/i);
    expect(bat).not.toMatch(/5432/);
  });
});
