/**
 * Measure document.documentElement.scrollWidth at 360 / 375 / 414.
 *
 *   pnpm start
 *   pnpm test:scroll-width
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const puppeteer = createRequire(import.meta.url)("puppeteer-core");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const USER = process.env.SHOT_USER ?? "Member A";
const PASS = process.env.SHOT_PASS ?? "demo-pass-1";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";

const WIDTHS = [360, 375, 414];
const PAGES = [
  { name: "login", path: "/login", auth: false },
  { name: "overview", path: "/overview", auth: true },
  { name: "entry", path: "/entry", auth: true },
  { name: "holdings", path: "/holdings", auth: true },
  { name: "watchlist", path: "/holdings", auth: true, tab: "關注" },
  { name: "instrument", path: "/instrument/AAPL", auth: true },
  { name: "ledger", path: "/ledger", auth: true },
  { name: "returns", path: "/returns", auth: true },
  { name: "account", path: "/account", auth: true },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
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
    const measured = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      pagePad: document.querySelector("main")
        ? Math.round(parseFloat(getComputedStyle(document.querySelector("main")).paddingLeft))
        : null,
      pageW: document.querySelector(".page") ? Math.round(document.querySelector(".page").getBoundingClientRect().width) : null,
      barH: document.querySelector(".mobile-bar") ? Math.round(document.querySelector(".mobile-bar").getBoundingClientRect().height) : null,
    }));
    const ok = measured.scrollWidth === width;
    if (!ok) bad += 1;
    rows.push({ name: item.name, width, ...measured, ok });
    console.log(`${item.name}@${width} scrollWidth=${measured.scrollWidth} ${ok ? "ok" : "FAIL"}`);
  }
}

const md = [
  "# Mobile document width",
  "",
  "Measured with `document.documentElement.scrollWidth` in Chromium after the tape overflow fix.",
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
    `| ${name} | ${a.scrollWidth}${a.ok ? "" : " ✗"} | ${b.scrollWidth}${b.ok ? "" : " ✗"} | ${c.scrollWidth}${c.ok ? "" : " ✗"} | ${b.pagePad ?? "—"} | ${b.pageW ?? "—"} | ${b.barH ?? "—"} |`,
  );
}
md.push("");
writeFileSync(join(ROOT, "docs/screenshots/scroll-width.md"), `${md.join("\n")}\n`);
await browser.close();
if (bad) {
  process.exit(1);
}
console.log("measure-scroll-width: ok");
