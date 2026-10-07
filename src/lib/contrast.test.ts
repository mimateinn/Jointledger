import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseCssColor, paint, type Rgb } from "./contrast";

const tokensCss = readFileSync(join(import.meta.dirname, "../app/tokens.css"), "utf8");
const componentsCss = readFileSync(join(import.meta.dirname, "../app/components.css"), "utf8");
const globalsCss = readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");
const returnsClient = readFileSync(
  join(import.meta.dirname, "../app/(app)/returns/returns-client.tsx"),
  "utf8",
);

const TEXT_MIN = 4.5;

type Theme = Record<string, string>;

function braceBlock(source: string, from: number): string {
  const open = source.indexOf("{", from);
  if (open < 0) {
    throw new Error("missing block");
  }
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, i);
      }
    }
  }
  throw new Error("unbalanced block");
}

function parseDecls(block: string): Theme {
  const theme: Theme = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    theme[match[1]] = match[2].trim();
  }
  return theme;
}

function mergeTheme(source: string, needles: string[]): Theme {
  const theme: Theme = {};
  for (const needle of needles) {
    let from = 0;
    while (from < source.length) {
      const at = source.indexOf(needle, from);
      if (at < 0) {
        break;
      }
      Object.assign(theme, parseDecls(braceBlock(source, at)));
      from = at + needle.length;
    }
  }
  return theme;
}

function resolveValue(theme: Theme, name: string, seen = new Set<string>()): string {
  if (seen.has(name)) {
    throw new Error(`cycle: ${name}`);
  }
  seen.add(name);
  const raw = theme[name];
  if (!raw) {
    throw new Error(`missing token --${name}`);
  }
  const ref = raw.match(/^var\(--([a-z0-9-]+)\)$/i);
  return ref ? resolveValue(theme, ref[1], seen) : raw;
}

function rgbOn(theme: Theme, name: string, onto?: Rgb): Rgb {
  const color = parseCssColor(resolveValue(theme, name));
  if (color.alpha >= 1) {
    return color.rgb;
  }
  if (!onto) {
    throw new Error(`--${name} is translucent and needs a backdrop`);
  }
  return paint(color, onto);
}

const light = mergeTheme(tokensCss, ['[data-theme="light"]']);
const dark = mergeTheme(tokensCss, [':root,\n[data-theme="dark"]', '[data-theme="dark"]']);

type Pair = {
  fg: string;
  bg: string;
  onto?: "bg" | "surface";
};

/** Every token used as `color:` / fill text, against the surfaces it sits on. */
const TEXT_PAIRS: Pair[] = [
  { fg: "text", bg: "bg" },
  { fg: "text", bg: "surface" },
  { fg: "text", bg: "surface-hover" },
  { fg: "text", bg: "surface-selected", onto: "surface" },
  { fg: "text", bg: "surface-selected", onto: "bg" },
  { fg: "muted", bg: "bg" },
  { fg: "muted", bg: "surface" },
  { fg: "muted", bg: "surface-hover" },
  { fg: "muted", bg: "surface-selected", onto: "surface" },
  { fg: "muted", bg: "surface-selected", onto: "bg" },
  { fg: "ink-text", bg: "bg" },
  { fg: "ink-text", bg: "surface" },
  { fg: "ink-text", bg: "surface-hover" },
  { fg: "ink-text", bg: "surface-selected", onto: "surface" },
  { fg: "ink-text", bg: "surface-selected", onto: "bg" },
  { fg: "link", bg: "bg" },
  { fg: "link", bg: "surface" },
  { fg: "link", bg: "surface-hover" },
  { fg: "link-hover", bg: "bg" },
  { fg: "link-hover", bg: "surface" },
  { fg: "on-ink", bg: "ink" },
  { fg: "on-ink", bg: "ink-hover" },
  { fg: "on-ink", bg: "ink-press" },
  { fg: "up", bg: "bg" },
  { fg: "up", bg: "surface" },
  { fg: "up", bg: "surface-hover" },
  { fg: "up", bg: "up-bg" },
  { fg: "down", bg: "bg" },
  { fg: "down", bg: "surface" },
  { fg: "down", bg: "surface-hover" },
  { fg: "down", bg: "down-bg" },
  { fg: "delay-text", bg: "delay-bg", onto: "surface" },
  { fg: "st-ok", bg: "bg" },
  { fg: "st-ok", bg: "surface" },
  { fg: "st-err", bg: "bg" },
  { fg: "st-err", bg: "surface" },
  { fg: "st-warn", bg: "bg" },
  { fg: "st-warn", bg: "surface" },
];

function pairRatio(theme: Theme, pair: Pair): { label: string; ratio: number } {
  const onto = pair.onto ? rgbOn(theme, pair.onto) : undefined;
  const bg = rgbOn(theme, pair.bg, onto);
  const fg = rgbOn(theme, pair.fg);
  const backdrop = pair.onto ? `${pair.bg} on ${pair.onto}` : pair.bg;
  return {
    label: `${pair.fg} / ${backdrop}`,
    ratio: contrastRatio(fg, bg),
  };
}

describe("text-colour token contrast", () => {
  it("keeps --ink as the fill and --ink-text as the readable orange", () => {
    expect(light["ink"]).toBe("#e85d04");
    expect(dark["ink"]).toBe("#e85d04");
    expect(light["ink-text"]).toBe("#b84a03");
    expect(dark["ink-text"]).toBe("#f08a4b");
    expect(light["icon-accent"]).toBe("var(--ink-text)");
    expect(dark["icon-accent"]).toBe("var(--ink-text)");
  });

  it("does not use --ink as a CSS text colour", () => {
    expect(componentsCss).not.toMatch(/(?<![-])color:\s*var\(--ink\)/);
    expect(globalsCss).not.toMatch(/(?<![-])color:\s*var\(--ink\)/);
    expect(returnsClient).toMatch(/var\(--ink-text\)/);
    expect(returnsClient).not.toMatch(/var\(--ink\)(?!-text)/);
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)("%s text tokens are >= 4.5:1 on their backgrounds", (name, theme) => {
    const failed: string[] = [];
    for (const pair of TEXT_PAIRS) {
      const { label, ratio } = pairRatio(theme, pair);
      if (ratio < TEXT_MIN) {
        failed.push(`${name} ${label}: ${ratio.toFixed(2)}`);
      }
    }
    expect(failed, failed.join("\n")).toEqual([]);
  });
});
