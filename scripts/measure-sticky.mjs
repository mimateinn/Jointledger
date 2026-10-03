/**
 * Record sticky control tops at 375x812 and 375x667.
 *
 *   CHROME_PATH=/path/to/chrome pnpm test:sticky
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

const VIEWPORTS = [
  { w: 375, h: 812 },
  { w: 375, h: 667 },
];
const PAGES = [
  { name: "entry", path: "/entry", sels: [".entry-sticky", ".mobile-bar"] },
  { name: "overview", path: "/overview", sels: [".mobile-bar"] },
  { name: "holdings", path: "/holdings", sels: [".mobile-bar"] },
  { name: "ledger", path: "/ledger", sels: [".mobile-bar"] },
  { name: "account", path: "/account", sels: [".mobile-bar"] },
];

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
for (const vp of VIEWPORTS) {
  await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
  for (const item of PAGES) {
    await page.goto(`${BASE}${item.path}`, { waitUntil: "networkidle0", timeout: 60000 });
    if (item.name === "entry") {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await new Promise((r) => setTimeout(r, 200));
    const measured = await page.evaluate((sels) => {
      const h = window.innerHeight;
      return sels.map((sel) => {
        const el = document.querySelector(sel);
        if (!el) {
          return { sel, missing: true };
        }
        const r = el.getBoundingClientRect();
        return {
          sel,
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          visible: r.top >= 0 && r.top < h && r.bottom > 0,
        };
      });
    }, item.sels);
    for (const row of measured) {
      const ok = !row.missing && row.visible;
      if (!ok) {
        bad += 1;
      }
      rows.push({ page: item.name, ...vp, ...row, ok });
      console.log(
        `${item.name}@${vp.w}x${vp.h} ${row.sel} top=${row.top ?? "-"} visible=${row.visible ?? false} ${ok ? "ok" : "FAIL"}`,
      );
    }
  }
}

const md = [
  "# Sticky tops at 375",
  "",
  "Measured after removing `.app-frame { overflow-x: hidden }` (that rule created a scroll container and parked `.entry-sticky` below the viewport).",
  "",
  "| Page | Viewport | Selector | top | bottom | visible |",
  "|---|---|---|---:|---:|---|",
];
for (const row of rows) {
  md.push(
    `| ${row.page} | ${row.w}x${row.h} | \`${row.sel}\` | ${row.top ?? "-"} | ${row.bottom ?? "-"} | ${row.ok ? "yes" : "NO"} |`,
  );
}
md.push("");
writeFileSync(join(ROOT, "docs/screenshots/sticky-tops.md"), `${md.join("\n")}\n`);
await browser.close();
if (bad) {
  process.exit(1);
}
console.log("measure-sticky: ok");
