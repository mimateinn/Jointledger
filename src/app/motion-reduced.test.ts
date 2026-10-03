import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = import.meta.dirname;

function css(file: string): string {
  return readFileSync(join(root, file), "utf8");
}

describe("reduced-motion cascade", () => {
  it("does not let globals.css reintroduce a skeleton animation", () => {
    expect(css("globals.css")).not.toMatch(/\.skeleton\s*\{[^}]*animation\s*:/s);
  });

  it("stops skeleton, mobile-bar press, and theme-toggle rotate when reduced", () => {
    const motion = css("motion.css");
    expect(motion).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(motion).toMatch(/\.is-reduced/);
    expect(motion).toMatch(/\.skeleton,\s*\n\s*\.skeleton::after\s*\{\s*animation:\s*none\s*!important/);
    expect(motion).toMatch(/\.mobile-bar a:active/);
    expect(motion).toMatch(/\.theme-toggle:active \.icon\s*\{\s*transform:\s*none\s*!important/);
    expect(motion).toMatch(/\.mobile-bar a:active\s*\{\s*transform:\s*scale\(var\(--press-scale\)\)/);
  });
});
