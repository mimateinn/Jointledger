import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = import.meta.dirname;

function css(file: string): string {
  return readFileSync(join(root, file), "utf8");
}

function reducedMotionBlock(motion: string): string {
  const start = motion.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start).toBeGreaterThan(-1);
  const after = motion.slice(start);
  const next = after.search(/\n\.is-reduced\b/);
  return next === -1 ? after : after.slice(0, next);
}

describe("reduced-motion cascade", () => {
  it("does not let globals.css reintroduce a skeleton animation", () => {
    expect(css("globals.css")).not.toMatch(/\.skeleton\s*\{[^}]*animation\s*:/s);
  });

  it("stops skeleton, mobile-bar press, and theme-toggle rotate inside the reduce media block", () => {
    const motion = css("motion.css");
    const reduce = reducedMotionBlock(motion);
    expect(reduce).toMatch(/\.skeleton,\s*\n\s*\.skeleton::after\s*\{\s*animation:\s*none\s*!important/);
    expect(reduce).toMatch(/\.mobile-bar a:active[\s\S]*transform:\s*none\s*!important/);
    expect(reduce).toMatch(/\.theme-toggle:active \.icon[\s\S]*transform:\s*none\s*!important/);
    expect(motion).toMatch(/\.mobile-bar a:active\s*\{\s*transform:\s*scale\(var\(--press-scale\)\)/);
    expect(reduce).toMatch(/--press-scale:\s*1/);
    expect(reduce).toMatch(/--press-drop:\s*0px/);
    expect(reduce).toMatch(/--dur-theme:\s*0ms/);
    expect(motion).toMatch(/\.is-reduced\s*\{[^}]*--press-scale:\s*1/s);
    expect(motion).toMatch(/\.is-reduced\s*\{[^}]*--dur-theme:\s*0ms/s);
    expect(motion).toMatch(/\.is-reduced \.skeleton,\s*\n\s*\.is-reduced \.skeleton::after\s*\{\s*animation:\s*none\s*!important/);
    expect(motion).toMatch(/\.is-reduced \.mobile-bar a:active[\s\S]*transform:\s*none\s*!important/);
  });

  it("keeps first-run tips on the shared enter class so reduce already covers them", () => {
    const tips = readFileSync(join(root, "../components/first-run-tips.tsx"), "utf8");
    expect(tips).toContain("is-entering");
    expect(tips).not.toMatch(/animation:\s*(?!none)/);
    expect(css("motion.css")).toMatch(/\.is-entering\s*\{[^}]*jl-rise-in/s);
    expect(css("motion.css")).toMatch(/--mv-y:\s*0px/);
  });
});
