/**
 * Fail if any in-page element overflows the viewport (except the tape track
 * and other intentionally horizontal scrollers).
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

function measureOverflow() {
  const vw = window.innerWidth;
  const skip = (el) => {
    if (!(el instanceof Element)) {
      return true;
    }
    if (el.closest(".tape-track")) {
      return true;
    }
    let node = el;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const ox = style.overflowX;
      if ((ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth + 1) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
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
          ".tape-lead,.tape-pin{flex:0 0 auto!important;flex-shrink:0!important;min-width:max-content!important;max-width:none!important;overflow:visible!important}",
          ".tape-lead .tape-name,.tape-pin .chip-delay{display:inline-flex!important}",
        ].join(""),
      });
    }
    const measured = await page.evaluate(measureOverflow);
    const layout = await page.evaluate(() => ({
      pagePad: document.querySelector("main")
        ? Math.round(parseFloat(getComputedStyle(document.querySelector("main")).paddingLeft))
        : null,
      pageW: document.querySelector(".page") ? Math.round(document.querySelector(".page").getBoundingClientRect().width) : null,
      barH: document.querySelector(".mobile-bar") ? Math.round(document.querySelector(".mobile-bar").getBoundingClientRect().height) : null,
    }));
    const ok = measured.overflowCount === 0;
    if (!ok) {
      bad += 1;
    }
    rows.push({ name: item.name, width, ...measured, ...layout, ok });
    const extra = measured.offenders[0] ? ` ${measured.offenders[0].cls}@${measured.offenders[0].right}` : "";
    console.log(
      `${item.name}@${width} scrollWidth=${measured.scrollWidth} overflow=${measured.overflowCount}${extra} ${ok ? "ok" : "FAIL"}`,
    );
  }
}

if (!INJECT_OLD_TAPE) {
  const md = [
    "# Mobile document width",
    "",
    "Overflow is measured from element bounding rects (right edge > viewport + 1), excluding `.tape-track` and horizontal scrollers. `documentElement.scrollWidth` is reported but is not the pass/fail signal.",
    "375 spec: page margin 16 / content 343 / bottom bar 56.",
    "",
    "| Page | 360 | 375 | 414 | 375 margin | 375 content | 375 bar |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];
  for (const name of PAGES.map((p) => p.name)) {
    const a = rows.find((r) => r.name === name && r.width === 360);
    const b = rows.find((r) => r.name === name && r.width === 375);
    const c = rows.find((r) => r.name === name && r.width === 414);
    md.push(
      `| ${name} | ${a.scrollWidth}${a.ok ? "" : " FAIL"} | ${b.scrollWidth}${b.ok ? "" : " FAIL"} | ${c.scrollWidth}${c.ok ? "" : " FAIL"} | ${b.pagePad ?? "-"} | ${b.pageW ?? "-"} | ${b.barH ?? "-"} |`,
    );
  }
  md.push("");
  writeFileSync(join(ROOT, "docs/screenshots/scroll-width.md"), `${md.join("\n")}\n`);
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
