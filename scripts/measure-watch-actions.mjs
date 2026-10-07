/**
 * Fail if watchlist action buttons are below a 44×44 hit target at 320 / 375.
 *
 *   CHROME_PATH=/path/to/chrome pnpm start
 *   CHROME_PATH=/path/to/chrome pnpm test:watch-actions
 *
 * --inject-hit-min-30        sets --hit-min: 30px (must fail)
 * --inject-watch-height-20   sets .watch-list .btn { height: 20px !important } (must fail)
 */
import { createRequire } from "node:module";
import { resolveChrome } from "./chrome-path.mjs";

const puppeteer = createRequire(import.meta.url)("puppeteer-core");
const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const USER = process.env.SHOT_USER ?? "Member A";
const PASS = process.env.SHOT_PASS ?? "demo-pass-1";
const INJECT_HIT_MIN_30 = process.argv.includes("--inject-hit-min-30");
const INJECT_WATCH_HEIGHT_20 = process.argv.includes("--inject-watch-height-20");
const MIN = 44;
const WIDTHS = [320, 375];

function declaredPx(el, prop) {
  let value = null;
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule)) {
        continue;
      }
      try {
        if (!el.matches(rule.selectorText)) {
          continue;
        }
      } catch {
        continue;
      }
      const raw = rule.style.getPropertyValue(prop);
      if (raw) {
        value = raw;
      }
    }
  }
  const n = value ? parseFloat(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function measureWatchActions() {
  const buttons = [...document.querySelectorAll(".watch-actions .btn")];
  return buttons.map((btn) => {
    const rect = btn.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    return {
      text: (btn.textContent ?? "").trim().slice(0, 16),
      width: rect.width,
      height: rect.height,
      minWidth: parseFloat(cs.minWidth) || 0,
      minHeight: parseFloat(cs.minHeight) || 0,
      declaredHeight: declaredPx(btn, "height"),
      declaredMinHeight: declaredPx(btn, "min-height"),
    };
  });
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

let bad = 0;
const rows = [];
for (const width of WIDTHS) {
  await page.setViewport({ width, height: 812, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/holdings`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "關注")?.click();
  });
  await page.waitForSelector(".watch-actions .btn", { timeout: 15000 });
  if (INJECT_HIT_MIN_30) {
    await page.addStyleTag({ content: ":root { --hit-min: 30px !important; }" });
  }
  if (INJECT_WATCH_HEIGHT_20) {
    await page.addStyleTag({ content: ".watch-list .btn { height: 20px !important; }" });
  }
  const measured = await page.evaluate(measureWatchActions);
  if (measured.length === 0) {
    bad += 1;
    console.log(`watch-actions@${width} no .watch-actions .btn FAIL`);
    continue;
  }
  for (const item of measured) {
    const tooSmall =
      item.width < MIN ||
      item.height < MIN ||
      item.minWidth < MIN ||
      item.minHeight < MIN ||
      (item.declaredHeight != null && item.declaredHeight < MIN) ||
      (item.declaredMinHeight != null && item.declaredMinHeight < MIN);
    if (tooSmall) {
      bad += 1;
    }
    rows.push({ width, ...item, ok: !tooSmall });
    console.log(
      `watch-actions@${width} "${item.text}" ${Math.round(item.width)}×${Math.round(item.height)} min=${Math.round(item.minWidth)}×${Math.round(item.minHeight)} declaredH=${item.declaredHeight ?? "-"} ${tooSmall ? "FAIL" : "ok"}`,
    );
  }
}

await browser.close();
if (INJECT_HIT_MIN_30 || INJECT_WATCH_HEIGHT_20) {
  const tag = INJECT_HIT_MIN_30 ? "inject-hit-min-30" : "inject-watch-height-20";
  console.log(`measure-watch-actions: ${tag} fails=${bad}`);
  process.exit(bad > 0 ? 2 : 0);
}
if (bad) {
  process.exit(1);
}
console.log("measure-watch-actions: ok");
