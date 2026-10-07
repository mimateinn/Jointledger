/**
 * Stress-test ledger filter clicks against a running production build.
 *
 *   pnpm start   # with seeded demo data
 *   pnpm test:ledger-filter
 *
 * Performs >= 30 apply / clear / toggle / Enter actions and fails if any
 * click is dropped (URL or input unchanged).
 */
import { createRequire } from "node:module";
import { resolveChrome } from "./chrome-path.mjs";

const puppeteer = createRequire(import.meta.url)("puppeteer-core");
const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const USER = process.env.SHOT_USER ?? "Member A";
const PASS = process.env.SHOT_PASS ?? "demo-pass-1";

const dropped = [];
const notes = [];

function fail(step, detail) {
  dropped.push(`${step}: ${detail}`);
}

async function waitFor(page, check, label, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(check)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  fail(label, await page.evaluate(() => `${location.search} q=${document.querySelector('input[name="q"]')?.value}`));
  return false;
}

const browser = await puppeteer.launch({
  executablePath: resolveChrome(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await page.type("#identifier", USER);
await page.type("#password", PASS);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")]);
await page.goto(`${BASE}/ledger?view=trades`, { waitUntil: "networkidle0" });
await page.waitForSelector('input[name="q"]');

async function clickText(text) {
  await page.evaluate((label) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
    btn?.click();
  }, text);
}

let actions = 0;
for (let i = 0; i < 10; i += 1) {
  await page.click('input[name="q"]', { clickCount: 3 });
  await page.type('input[name="q"]', "AAPL");
  await page.click('button[type="submit"]');
  actions += 1;
  await waitFor(page, () => location.search.includes("q=AAPL") && document.querySelector('input[name="q"]')?.value === "AAPL", `apply#${i}`);
  const focusAfterApply = await page.evaluate(() => document.activeElement?.getAttribute("name"));
  if (focusAfterApply !== "q") {
    fail(`focus#${i}`, `active=${focusAfterApply}`);
  }

  await clickText("清除篩選");
  actions += 1;
  await waitFor(page, () => !location.search.includes("q=") && document.querySelector('input[name="q"]')?.value === "", `clear#${i}`);

  await clickText("出入金");
  actions += 1;
  await waitFor(page, () => !location.search.includes("view=trades"), `cash#${i}`);

  await clickText("買賣");
  actions += 1;
  await waitFor(page, () => location.search.includes("view=trades"), `trades#${i}`);
}

await page.click('input[name="q"]', { clickCount: 3 });
await page.type('input[name="q"]', "NVDA");
await page.keyboard.press("Enter");
actions += 1;
await waitFor(page, () => location.search.includes("q=NVDA") && document.querySelector('input[name="q"]')?.value === "NVDA", "enter");

await page.reload({ waitUntil: "networkidle0" });
const afterReload = await page.$eval('input[name="q"]', (el) => el.value);
if (afterReload !== "NVDA") {
  fail("reload", `q=${afterReload}`);
}

await clickText("清除篩選");
await waitFor(page, () => !location.search.includes("q="), "clear-before-back");
await page.goBack();
await waitFor(page, () => location.search.includes("q=NVDA") && document.querySelector('input[name="q"]')?.value === "NVDA", "back");

await page.goto(`${BASE}/ledger?member=joint`, { waitUntil: "networkidle0" });
actions += 1;
await waitFor(
  page,
  () =>
    !location.search.includes("member=joint") &&
    document.querySelector('select[name="member"]')?.value === "" &&
    document.querySelectorAll("tbody tr:not(.month-row)").length > 0,
  "joint-on-cash",
);
const jointCash = await page.evaluate(() => ({
  search: location.search,
  memberValue: document.querySelector('select[name="member"]')?.value ?? "",
  rows: document.querySelectorAll("tbody tr:not(.month-row)").length,
  count: document.querySelector(".filter-count")?.textContent ?? "",
}));
notes.push(`joint-on-cash member=${jointCash.memberValue || "全部"} rows=${jointCash.rows} search=${jointCash.search || "(empty)"} ${jointCash.count}`);

notes.push(`actions=${actions}`);
notes.push(`dropped=${dropped.length}`);
if (dropped.length) {
  notes.push(...dropped);
}
await browser.close();
console.log(notes.join("\n"));
if (dropped.length || actions < 30) {
  process.exit(1);
}
console.log("ledger-filter-stress: ok");
