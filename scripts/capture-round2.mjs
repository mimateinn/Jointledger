/**
 * Round-2 evidence shots into docs/screenshots/round2/{before|after}.
 *
 *   SHOT_OUT=docs/screenshots/round2/after SHOT_BASE=http://127.0.0.1:3000 \
 *     node scripts/capture-round2.mjs [app|first-use|features]
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChrome } from "./chrome-path.mjs";

const puppeteer = createRequire(import.meta.url)("puppeteer-core");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, process.env.SHOT_OUT ?? "docs/screenshots/round2/after");
const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const USER = process.env.SHOT_USER ?? "Member A";
const PASS = process.env.SHOT_PASS ?? "demo-pass-1";

mkdirSync(OUT, { recursive: true });

const SIZES = {
  1440: { width: 1440, height: 900 },
  375: { width: 375, height: 812 },
};

async function setTheme(page, theme, extra = {}) {
  await page.evaluate(
    ({ theme, reduced, tips }) => {
      localStorage.setItem("jl-theme", theme);
      localStorage.setItem("jl-reduced", reduced ? "1" : "0");
      if (tips === "show") {
        localStorage.removeItem("joint-ledger.tips.v1");
      } else if (tips === "hide") {
        localStorage.setItem("joint-ledger.tips.v1", "1");
      }
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.classList.toggle("is-reduced", Boolean(reduced));
    },
    { theme, reduced: extra.reduced, tips: extra.tips },
  );
}

async function shot(page, name, viewport, theme, extra = {}) {
  await page.setViewport({ ...SIZES[viewport], deviceScaleFactor: 1 });
  await setTheme(page, theme, extra);
  if (extra.reload) {
    await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  }
  await page.waitForSelector("body", { timeout: 30000 });
  await page.evaluate((vp) => {
    document.querySelectorAll("nextjs-portal, #__next-build-watcher").forEach((el) => el.remove());
    if (vp === 375) {
      document.querySelectorAll(".mobile-bar").forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });
    }
  }, viewport);
  await new Promise((r) => setTimeout(r, extra.wait ?? 350));
  const file = `${name}-${viewport}-${theme}${extra.reduced ? "-reduced" : ""}.png`;
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage: extra.fullPage !== false });
  console.log("shot", file);
}

async function login(page, user = USER) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
  const identifier = await page.$("#identifier");
  if (!identifier) {
    const current = await page.evaluate(() => document.body?.innerText ?? "");
    if (current.includes(user)) {
      return;
    }
    await page.evaluate(() => {
      [...document.querySelectorAll("button, a")].find((el) => el.textContent?.includes("登出"))?.click();
    });
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }).catch(() => {});
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
  }
  const field = await page.$("#identifier");
  if (!field) {
    return;
  }
  await page.evaluate(() => {
    const id = document.querySelector("#identifier");
    const pw = document.querySelector("#password");
    if (id) id.value = "";
    if (pw) pw.value = "";
  });
  await page.type("#identifier", user);
  await page.type("#password", PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }),
    page.click("button[type=submit]"),
  ]);
}

async function evalClick(page, fn) {
  await page.evaluate(fn);
  await new Promise((r) => setTimeout(r, 250));
}

async function openLedgerUndo(page) {
  await page.goto(`${BASE}/ledger?view=trades`, { waitUntil: "networkidle0", timeout: 60000 });
  await evalClick(page, () => {
    document.querySelector('button[aria-label^="刪除"]')?.click();
  });
  await evalClick(page, () => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "確認刪除")?.click();
  });
  await page.waitForSelector("[data-undo-toast]", { timeout: 5000 });
}

async function clickText(page, selector, label) {
  await page.evaluate(
    ({ selector, label }) => {
      const nodes = [...document.querySelectorAll(selector)];
      nodes.find((el) => el.textContent?.trim() === label)?.click();
    },
    { selector, label },
  );
  await new Promise((r) => setTimeout(r, 250));
}

async function capturePage(page, name, url, themes = ["light", "dark"]) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0", timeout: 60000 });
  for (const vp of [1440, 375]) {
    for (const theme of themes) {
      await shot(page, name, vp, theme, { reload: true, wait: name === "holdings" || name.startsWith("instrument") ? 800 : 350 });
    }
  }
}

async function captureApp(page) {
  await login(page);
  await capturePage(page, "overview", "/overview");
  await shot(page, "overview", 1440, "light", { reload: true, reduced: true, wait: 300 });
  await capturePage(page, "entry", "/entry");
  await capturePage(page, "holdings", "/holdings");

  for (const vp of [1440, 375]) {
    for (const theme of ["light", "dark"]) {
      await page.setViewport({ ...SIZES[vp], deviceScaleFactor: 1 });
      await setTheme(page, theme);
      await page.goto(`${BASE}/holdings`, { waitUntil: "networkidle0", timeout: 60000 });
      await clickText(page, "button", "關注");
      await shot(page, "watchlist", vp, theme, { wait: 400 });
    }
  }

  await capturePage(page, "instrument-aapl", "/instrument/AAPL");
  await capturePage(page, "ledger", "/ledger");
  await capturePage(page, "returns", "/returns");
  await capturePage(page, "account", "/account");

  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("登出"))?.click();
  });
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }).catch(() => {});
  await capturePage(page, "login", "/login");
}

async function captureFirstUse(page) {
  await login(page, process.env.SHOT_FIRST_USE_USER ?? "First Use");
  await page.goto(`${BASE}/first-use`, { waitUntil: "networkidle0", timeout: 60000 });
  for (const vp of [1440, 375]) {
    for (const theme of ["light", "dark"]) {
      await shot(page, "first-use", vp, theme, { reload: false, wait: 300 });
    }
  }
}

async function captureFeatures(page) {
  await login(page);
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0", timeout: 60000 });
  for (const vp of [1440, 375]) {
    await shot(page, "overview-tips", vp, "light", { reload: true, tips: "show", wait: 400 });
  }

  await page.goto(`${BASE}/entry`, { waitUntil: "networkidle0", timeout: 60000 });
  await clickText(page, "button", "股息");
  await new Promise((r) => setTimeout(r, 250));
  for (const vp of [1440, 375]) {
    for (const theme of ["light", "dark"]) {
      await shot(page, "entry-dividend", vp, theme, { wait: 250 });
    }
  }

  for (const vp of [1440, 375]) {
    for (const theme of ["light", "dark"]) {
      await page.setViewport({ ...SIZES[vp], deviceScaleFactor: 1 });
      await setTheme(page, theme);
      await openLedgerUndo(page);
      await shot(page, "ledger-delete-undo", vp, theme, { wait: 200, fullPage: vp !== 375 });
    }
  }
}

const browser = await puppeteer.launch({
  executablePath: resolveChrome(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  defaultViewport: SIZES[1440],
});
const page = await browser.newPage();
page.setDefaultTimeout(60000);

const mode = process.argv[2] ?? "app";
try {
  if (mode === "app" || mode === "all") {
    await captureApp(page);
  }
  if (mode === "first-use" || mode === "all") {
    await captureFirstUse(page);
  }
  if (mode === "features" || mode === "all") {
    await captureFeatures(page);
  }
} finally {
  await browser.close();
}
