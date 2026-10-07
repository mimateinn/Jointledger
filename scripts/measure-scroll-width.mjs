/**
 * Fail if any in-page element overflows the viewport, or if
 * documentElement.scrollWidth exceeds the viewport.
 *
 * Intentional horizontal scrollers must be marked `.table-scroll`,
 * `.tape-track`, or `.chip-scroll`. A plain `overflow-x: auto` wrapper
 * (e.g. 600px box / 900px child) is not excluded.
 *
 *   CHROME_PATH=/path/to/chrome pnpm start
 *   CHROME_PATH=/path/to/chrome pnpm test:scroll-width
 *
 * --inject-old-tape  applies flex-shrink:0 on .tape-lead/.tape-pin so a
 *                    regression can be proven to fail this check.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChrome } from "./chrome-path.mjs";

const puppeteer = createRequire(import.meta.url)("puppeteer-core");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const USER = process.env.SHOT_USER ?? "Member A";
const PASS = process.env.SHOT_PASS ?? "demo-pass-1";
const INJECT_OLD_TAPE = process.argv.includes("--inject-old-tape");

const WIDTHS = [360, 375, 414];
const TAPE_WIDTHS = [360, 375, 414, 480, 520, 600, 620, 630];
const TAPE_MIN = 80;
const MARKED_SCROLLERS = [".table-scroll", ".tape-track", ".chip-scroll"];
const PAGES = [
  { name: "login", path: "/login" },
  { name: "overview", path: "/overview" },
  { name: "entry", path: "/entry" },
  { name: "holdings", path: "/holdings" },
  { name: "watchlist", path: "/holdings", tab: "關注" },
  { name: "instrument", path: "/instrument/AAPL" },
  { name: "ledger", path: "/ledger" },
  { name: "returns", path: "/returns" },
  { name: "account", path: "/account" },
];

function measureOverflow(marked) {
  const vw = window.innerWidth;
  const skip = (el) => {
    if (!(el instanceof Element)) {
      return true;
    }
    return marked.some((sel) => el.closest(sel));
  };
  const offenders = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (skip(el)) {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) {
      continue;
    }
    if (rect.right > vw + 1) {
      offenders.push({
        cls: typeof el.className === "string" ? el.className.slice(0, 80) : el.tagName,
        right: Math.round(rect.right),
      });
    }
  }
  return {
    scrollWidth: document.documentElement.scrollWidth,
    viewport: vw,
    overflowCount: offenders.length,
    offenders: offenders.slice(0, 6),
  };
}

function measureTape() {
  const viewport = document.querySelector(".tape-viewport");
  const lead = document.querySelector(".tape-lead");
  const pin = document.querySelector(".tape-pin");
  return {
    tapeViewport: viewport ? Math.round(viewport.getBoundingClientRect().width) : 0,
    tapeLead: lead ? Math.round(lead.getBoundingClientRect().width) : 0,
    tapePin: pin ? Math.round(pin.getBoundingClientRect().width) : 0,
  };
}

const browser = await puppeteer.launch({
  executablePath: resolveChrome(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await page.type("#identifier", USER);
await page.type("#password", PASS);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")]);

const rows = [];
const tapeRows = [];
let bad = 0;
for (const item of PAGES) {
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 812, deviceScaleFactor: 1 });
    await page.goto(`${BASE}${item.path}`, { waitUntil: "networkidle0", timeout: 60000 });
    if (item.tab) {
      await page.evaluate((label) => {
        [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)?.click();
      }, item.tab);
      await new Promise((r) => setTimeout(r, 250));
    }
    if (INJECT_OLD_TAPE) {
      await page.addStyleTag({
        content: [
          ".tape{overflow:visible!important}",
          ".tape-lead{display:flex!important}",
          ".tape-lead,.tape-pin{flex:0 0 auto!important;flex-shrink:0!important;min-width:max-content!important;max-width:none!important;overflow:visible!important}",
          ".tape-lead .tape-name,.tape-lead .tape-proxy,.tape-pin .chip-delay{display:inline-flex!important}",
          ".tape-viewport{min-width:0!important;flex:1 1 auto!important}",
          ".tape-cell{white-space:nowrap!important;padding:0 16px!important}",
        ].join(""),
      });
    }
    const measured = await page.evaluate(measureOverflow, MARKED_SCROLLERS);
    const layout = await page.evaluate(() => ({
      pagePad: document.querySelector("main")
        ? Math.round(parseFloat(getComputedStyle(document.querySelector("main")).paddingLeft))
        : null,
      pageW: document.querySelector(".page") ? Math.round(document.querySelector(".page").getBoundingClientRect().width) : null,
      barH: document.querySelector(".mobile-bar") ? Math.round(document.querySelector(".mobile-bar").getBoundingClientRect().height) : null,
    }));
    const scrollOk = measured.scrollWidth <= measured.viewport;
    const ok = measured.overflowCount === 0 && scrollOk;
    if (!ok) {
      bad += 1;
    }
    rows.push({ name: item.name, width, ...measured, ...layout, ok, scrollOk });
    const extra = measured.offenders[0] ? ` ${measured.offenders[0].cls}@${measured.offenders[0].right}` : "";
    const scrollNote = scrollOk ? "" : " scrollWidth>viewport";
    console.log(
      `${item.name}@${width} scrollWidth=${measured.scrollWidth} overflow=${measured.overflowCount}${extra}${scrollNote} ${ok ? "ok" : "FAIL"}`,
    );
  }
}

if (!INJECT_OLD_TAPE) {
  for (const width of TAPE_WIDTHS) {
    await page.setViewport({ width, height: 812, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0", timeout: 60000 });
    const tape = await page.evaluate(measureTape);
    const ok = tape.tapeViewport >= TAPE_MIN;
    if (!ok) {
      bad += 1;
    }
    tapeRows.push({ width, ...tape, ok });
    console.log(
      `tape@${width} viewport=${tape.tapeViewport} lead=${tape.tapeLead} pin=${tape.tapePin} ${ok ? "ok" : "FAIL"}`,
    );
  }
}

if (!INJECT_OLD_TAPE) {
  const table = [
    "# Mobile document width (generated)",
    "",
    "Generated by `scripts/measure-scroll-width.mjs`. Proof notes live in `scroll-width.md` and are not overwritten.",
    "Overflow: element bounding rects (right > viewport + 1), excluding marked `.table-scroll` / `.tape-track` / `.chip-scroll`.",
    "`documentElement.scrollWidth` must be <= viewport. 375 spec: page margin 16 / content 343 / bottom bar 56.",
    "",
    "| Page | 360 | 375 | 414 | 375 margin | 375 content | 375 bar |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];
  for (const name of PAGES.map((p) => p.name)) {
    const a = rows.find((r) => r.name === name && r.width === 360);
    const b = rows.find((r) => r.name === name && r.width === 375);
    const c = rows.find((r) => r.name === name && r.width === 414);
    table.push(
      `| ${name} | ${a.scrollWidth}${a.ok ? "" : " FAIL"} | ${b.scrollWidth}${b.ok ? "" : " FAIL"} | ${c.scrollWidth}${c.ok ? "" : " FAIL"} | ${b.pagePad ?? "-"} | ${b.pageW ?? "-"} | ${b.barH ?? "-"} |`,
    );
  }
  table.push("");
  table.push("| Width | tape-viewport | tape-lead | tape-pin |");
  table.push("|---:|---:|---:|---:|");
  for (const row of tapeRows) {
    table.push(`| ${row.width} | ${row.tapeViewport}${row.ok ? "" : " FAIL"} | ${row.tapeLead} | ${row.tapePin} |`);
  }
  table.push("");
  writeFileSync(join(ROOT, "docs/screenshots/scroll-width-table.md"), `${table.join("\n")}\n`);
}

await browser.close();
if (INJECT_OLD_TAPE) {
  console.log(`measure-scroll-width: inject-old-tape overflows=${bad}`);
  process.exit(bad > 0 ? 2 : 0);
}
if (bad) {
  process.exit(1);
}
console.log("measure-scroll-width: ok");
