/**
 * Prove `.entry-sticky` is a real viewport sticky, not a bottom-of-page footer.
 *
 * Measures at scrollY=0 (the regression the old script missed). After
 * `scrollTo(bottom)` both the broken and fixed CSS land the bar on-screen,
 * so that measurement cannot catch `.app-frame { overflow-x: hidden }` /
 * `html,body { overflow-x: clip }`.
 *
 *   CHROME_PATH=/path/to/chrome pnpm test:sticky
 *   CHROME_PATH=/path/to/chrome node scripts/measure-sticky.mjs --inject-overflow-hidden
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
const INJECT_OVERFLOW = process.argv.includes("--inject-overflow-hidden");

const VIEWPORTS = [
  { w: 375, h: 812 },
  { w: 375, h: 667 },
];

const STICKY_SEL = ".entry-sticky";

function measureSticky(sel) {
  const el = document.querySelector(sel);
  const viewport = window.innerHeight;
  const pageHeight = Math.round(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  if (!el) {
    return { missing: true, viewport, pageHeight, scrollY: Math.round(window.scrollY) };
  }
  const rect = el.getBoundingClientRect();
  let offender = null;
  let node = el.parentElement;
  while (node && node !== document.documentElement.parentElement) {
    const style = getComputedStyle(node);
    const ox = style.overflowX;
    const oy = style.overflowY;
    if (ox !== "visible" || oy !== "visible") {
      const cls = typeof node.className === "string" && node.className ? `.${node.className.trim().split(/\s+/)[0]}` : "";
      offender = `${node.tagName.toLowerCase()}${cls} overflow-x=${ox} overflow-y=${oy}`;
      break;
    }
    node = node.parentElement;
  }
  return {
    missing: false,
    sel,
    top: Math.round(rect.top),
    bottom: Math.round(rect.bottom),
    viewport,
    pageHeight,
    scrollY: Math.round(window.scrollY),
    position: getComputedStyle(el).position,
    ancestorOk: !offender,
    offender,
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

function judge(row) {
  if (row.missing) {
    return { ok: false, why: "missing" };
  }
  if (row.position !== "sticky") {
    return { ok: false, why: `position=${row.position}` };
  }
  if (!row.ancestorOk) {
    return { ok: false, why: `ancestor ${row.offender}` };
  }
  if (!(row.top < row.viewport)) {
    return { ok: false, why: `top ${row.top} >= viewport ${row.viewport}` };
  }
  return { ok: true, why: "ok" };
}

for (const vp of VIEWPORTS) {
  await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/entry`, { waitUntil: "networkidle0", timeout: 60000 });
  if (INJECT_OVERFLOW) {
    await page.addStyleTag({
      content: [".app-frame{overflow-x:hidden}", "html,body{overflow-x:clip}"].join(""),
    });
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 200));
  const atTop = await page.evaluate(measureSticky, STICKY_SEL);
  const topJudge = judge(atTop);
  if (!topJudge.ok) {
    bad += 1;
  }
  rows.push({ at: "scroll-0", ...vp, ...atTop, ...topJudge });
  console.log(
    `entry@${vp.w}x${vp.h} scroll=0 ${STICKY_SEL} top=${atTop.top ?? "-"} pageH=${atTop.pageHeight} ancestor=${atTop.offender ?? "visible"} ${topJudge.ok ? "ok" : `FAIL ${topJudge.why}`}`,
  );

  const midY = await page.evaluate(() => Math.max(0, Math.floor((document.documentElement.scrollHeight - window.innerHeight) / 2)));
  await page.evaluate((y) => window.scrollTo(0, y), midY);
  await new Promise((r) => setTimeout(r, 200));
  const atMid = await page.evaluate(measureSticky, STICKY_SEL);
  const midJudge = judge(atMid);
  rows.push({ at: "scroll-mid", ...vp, ...atMid, ...midJudge });
  console.log(
    `entry@${vp.w}x${vp.h} scroll=${atMid.scrollY} ${STICKY_SEL} top=${atMid.top ?? "-"} pageH=${atMid.pageHeight} ancestor=${atMid.offender ?? "visible"} ${midJudge.ok ? "ok" : `FAIL ${midJudge.why}`}`,
  );
}

if (!INJECT_OVERFLOW) {
  const md = [
    "# Sticky tops at 375",
    "",
    "`.entry-sticky` is `position: sticky` and must sit in the viewport at **scrollY = 0**.",
    "The entry page is taller than the phone viewport (page height 1167 > 812), so a broken ancestor (`overflow-x: hidden` / `clip`) parks the bar below the fold until you scroll to the bottom.",
    "`.mobile-bar` is `position: fixed` and is not a sticky proof.",
    "",
    "Pass condition: at scroll 0, `.entry-sticky` top < viewport height, and every ancestor has computed `overflow-x` and `overflow-y` of `visible`.",
    "",
    "Negative control: `node scripts/measure-sticky.mjs --inject-overflow-hidden` injects `.app-frame{overflow-x:hidden}` + `html,body{overflow-x:clip}` and must exit non-zero.",
    "",
    "| Viewport | scroll | top | bottom | pageH | ancestor | result |",
    "|---|---|---:|---:|---:|---|---|",
  ];
  for (const row of rows) {
    md.push(
      `| ${row.w}x${row.h} | ${row.at} (${row.scrollY ?? 0}) | ${row.top ?? "-"} | ${row.bottom ?? "-"} | ${row.pageHeight ?? "-"} | ${row.offender ?? "visible"} | ${row.ok ? "ok" : `FAIL ${row.why}`} |`,
    );
  }
  md.push("");
  writeFileSync(join(ROOT, "docs/screenshots/sticky-tops.md"), `${md.join("\n")}\n`);
}

await browser.close();
if (INJECT_OVERFLOW) {
  console.log(`measure-sticky: inject-overflow-hidden failures=${bad}`);
  process.exit(bad > 0 ? 2 : 0);
}
if (bad) {
  process.exit(1);
}
console.log("measure-sticky: ok");
