/**
 * Capture product screenshots into docs/screenshots/.
 * Requires a running app (default http://127.0.0.1:3000) and demo seed.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChrome } from "./chrome-path.mjs";

const puppeteer = createRequire(import.meta.url)("puppeteer-core");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/screenshots");
const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const USER = process.env.SHOT_USER ?? "Member A";
const PASS = process.env.SHOT_PASS ?? "demo-pass-1";
const CHROME = resolveChrome();

mkdirSync(OUT, { recursive: true });

const SIZES = {
  1440: { width: 1440, height: 900 },
  375: { width: 375, height: 812 },
};

async function setTheme(page, theme, reduced = false) {
  await page.evaluate(
    ({ theme, reduced }) => {
      localStorage.setItem("jl-theme", theme);
      localStorage.setItem("jl-reduced", reduced ? "1" : "0");
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.classList.toggle("is-reduced", reduced);
    },
    { theme, reduced },
  );
}

async function shot(page, name, viewport, theme, extra = {}) {
  await page.setViewport({ ...SIZES[viewport], deviceScaleFactor: 1 });
  await setTheme(page, theme, extra.reduced);
  if (extra.reload) {
    await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  }
  await page.waitForSelector("body", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, extra.wait ?? 400));
  const file = `${name}-${viewport}-${theme}${extra.reduced ? "-reduced" : ""}.png`;
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage: extra.fullPage !== false });
  console.log("shot", file);
  return path;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
  const identifier = await page.$("#identifier");
  if (!identifier) {
    throw new Error("login form missing #identifier (empty system?)");
  }
  await page.type("#identifier", USER);
  await page.type("#password", PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }),
    page.click("button[type=submit]"),
  ]);
}

async function measureAlignment(page) {
  await page.setViewport({ ...SIZES[1440], deviceScaleFactor: 1 });
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0", timeout: 60000 });
  const metrics = await page.evaluate(() => {
    const h1 = document.querySelector("main h1, .page-title");
    const card = document.querySelector("main .card");
    const page = document.querySelector("main .page");
    const bar = document.querySelector(".mobile-bar");
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    let inner = null;
    if (card) {
      const text = card.querySelector("h2, p, .metric-value, table, .card-title") ?? card;
      inner = box(text);
    }
    return {
      h1: box(h1),
      card: box(card),
      page: box(page),
      bar: box(bar),
      inner,
    };
  });
  await page.setViewport({ ...SIZES[375], deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  const mobile = await page.evaluate(() => {
    const page = document.querySelector("main .page");
    const card = document.querySelector("main .card, main .page");
    const bar = document.querySelector(".mobile-bar");
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return { page: box(page), card: box(card), bar: box(bar) };
  });
  const report = { desktop1440: metrics, mobile375: mobile };
  writeFileSync(join(OUT, "alignment.json"), JSON.stringify(report, null, 2));
  console.log("alignment", JSON.stringify(report));
  return report;
}

async function clickTab(page, label) {
  await page.evaluate((label) => {
    const buttons = [...document.querySelectorAll("button")];
    const match = buttons.find((b) => b.textContent?.trim() === label);
    match?.click();
  }, label);
  await new Promise((r) => setTimeout(r, 250));
}

async function captureCombos(page, name, url, extraWait = 400) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0", timeout: 60000 });
  for (const vp of [1440, 375]) {
    for (const theme of ["light", "dark"]) {
      await shot(page, name, vp, theme, { reload: true, wait: extraWait });
    }
  }
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    defaultViewport: SIZES[1440],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  const mode = process.argv[2] ?? "all";

  if (mode === "login-empty") {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
    for (const vp of [1440, 375]) {
      await shot(page, "login-empty", vp, "light", { reload: true });
    }
  }

  if (mode === "first-use") {
    await login(page);
    await page.goto(`${BASE}/first-use`, { waitUntil: "networkidle0", timeout: 60000 });
    for (const vp of [1440, 375]) {
      for (const theme of ["light", "dark"]) {
        await shot(page, "first-use", vp, theme, { reload: true });
      }
    }
  }

  if (mode === "app" || mode === "all") {
    await login(page);

    await captureCombos(page, "overview", "/overview", 600);
    await captureCombos(page, "entry", "/entry");
    await captureCombos(page, "holdings", "/holdings", 800);

    for (const vp of [1440, 375]) {
      for (const theme of ["light", "dark"]) {
        await page.setViewport({ ...SIZES[vp], deviceScaleFactor: 1 });
        await setTheme(page, theme);
        await page.goto(`${BASE}/holdings`, { waitUntil: "networkidle0", timeout: 60000 });
        await clickTab(page, "關注");
        await shot(page, "watchlist", vp, theme, { reload: false, wait: 400 });
      }
    }

    await page.goto(`${BASE}/holdings`, { waitUntil: "networkidle0", timeout: 60000 });
    await clickTab(page, "分佈");
    for (const vp of [1440, 375]) {
      for (const theme of ["light", "dark"]) {
        await setTheme(page, theme);
        await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
        await clickTab(page, "分佈");
        await shot(page, "holdings-allocation", vp, theme, { reload: false, wait: 300 });
      }
    }

    await captureCombos(page, "instrument-aapl", "/instrument/AAPL", 1200);
    await captureCombos(page, "ledger", "/ledger");
    await page.goto(`${BASE}/ledger?q=AAPL&type=buy&view=trades`, { waitUntil: "networkidle0", timeout: 60000 });
    await shot(page, "ledger-filter", 1440, "light", { reload: true });
    await captureCombos(page, "returns", "/returns");
    await captureCombos(page, "account", "/account", 500);
    await page.goto(`${BASE}/this-page-does-not-exist`, { waitUntil: "networkidle0", timeout: 60000 });
    for (const vp of [1440, 375]) {
      for (const theme of ["light", "dark"]) {
        await shot(page, "not-found", vp, theme, { reload: true });
      }
    }

    // Loading skeleton: delay the RSC document briefly and grab mid-navigation.
    await page.setViewport({ ...SIZES[1440], deviceScaleFactor: 1 });
    await setTheme(page, "light");
    await page.setRequestInterception(true);
    const hold = (request) => {
      const url = request.url();
      if (url.includes("/overview") && request.resourceType() === "document") {
        setTimeout(() => request.continue(), 2500);
      } else {
        request.continue();
      }
    };
    page.on("request", hold);
    const nav = page.goto(`${BASE}/overview`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 400));
    await shot(page, "loading", 1440, "light", { reload: false, fullPage: false, wait: 0 });
    await page.setViewport({ ...SIZES[375], deviceScaleFactor: 1 });
    await shot(page, "loading", 375, "light", { reload: false, fullPage: false, wait: 0 });
    await nav.catch(() => {});
    page.off("request", hold);
    await page.setRequestInterception(false);

    // Error boundary: inject the same card the product uses, then also hit a broken RSC if present.
    await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return;
      main.innerHTML = `
        <div class="page">
          <section class="card state-panel state-panel-error" role="alert" style="max-width:var(--reading-max)">
            <svg class="icon icon-24" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"></svg>
            <h2>呢頁暫時載唔到</h2>
            <p>唔好緊，再試一次就得。如果一直都係咁，請稍後再嚟。</p>
            <div class="state-actions">
              <button class="btn btn-primary" type="button">再試</button>
              <a href="/overview" class="btn btn-ghost">返回總覽</a>
            </div>
          </section>
        </div>`;
    });
    await shot(page, "error", 1440, "light", { reload: false });
    await page.setViewport({ ...SIZES[375], deviceScaleFactor: 1 });
    await shot(page, "error", 375, "light", { reload: false });
    await page.setViewport({ ...SIZES[1440], deviceScaleFactor: 1 });
    await setTheme(page, "dark");
    await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return;
      main.innerHTML = `
        <div class="page">
          <section class="card state-panel state-panel-error" role="alert" style="max-width:var(--reading-max)">
            <h2>呢頁暫時載唔到</h2>
            <p>唔好緊，再試一次就得。如果一直都係咁，請稍後再嚟。</p>
            <div class="state-actions">
              <button class="btn btn-primary" type="button">再試</button>
              <a href="/overview" class="btn btn-ghost">返回總覽</a>
            </div>
          </section>
        </div>`;
    });
    await shot(page, "error", 1440, "dark", { reload: false });
    await page.setViewport({ ...SIZES[375], deviceScaleFactor: 1 });
    await shot(page, "error", 375, "dark", { reload: false });

    // Tape lives on overview; extra tight crop not required — also reduced-motion overview.
    await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0", timeout: 60000 });
    await shot(page, "overview", 1440, "light", { reload: true, reduced: true, wait: 300 });

    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 }).catch(() => {});
    // logout via account if still in session
    await page.goto(`${BASE}/account`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("登出"));
      btn?.click();
    });
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }).catch(() => {});
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
    for (const vp of [1440, 375]) {
      for (const theme of ["light", "dark"]) {
        await shot(page, "login", vp, theme, { reload: true });
      }
    }

    await login(page);
    await measureAlignment(page);
  }

  if (mode === "states") {
    await login(page);
    await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0", timeout: 60000 });
    const warning = `<svg class="icon icon-24" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5L21 19.5H3z"/><path d="M12 10v4.5"/><path d="M11 17.3a1 1 0 1 0 2 0a1 1 0 1 0-2 0z" fill="currentColor" stroke="none"/></svg>`;
    const loadingHtml = `
      <div class="page" aria-busy="true" aria-label="載入中">
        <span class="sr-only">載入中…</span>
        <div class="page-head">
          <div class="skeleton skeleton-title"></div>
          <div class="chip-row">
            <div class="skeleton" style="width:72px;height:32px"></div>
            <div class="skeleton" style="width:72px;height:32px"></div>
            <div class="skeleton" style="width:72px;height:32px"></div>
          </div>
        </div>
        <div class="grid-12">
          <section class="card metric-card col-6">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-metric metric-value"></div>
            <div class="skeleton skeleton-sub metric-sub"></div>
          </section>
          <section class="card metric-card col-6">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-metric metric-value"></div>
            <div class="skeleton skeleton-sub metric-sub"></div>
          </section>
          <section class="card card-flush col-12">
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
          </section>
        </div>
      </div>`;
    const errorHtml = `
      <div class="page">
        <section class="card state-panel state-panel-error" role="alert" style="max-width:var(--reading-max)">
          ${warning}
          <h2>呢頁暫時載唔到</h2>
          <p>唔好緊，再試一次就得。如果一直都係咁，請稍後再嚟。</p>
          <div class="state-actions">
            <button class="btn btn-primary" type="button">再試</button>
            <a href="/overview" class="btn btn-ghost">返回總覽</a>
          </div>
        </section>
      </div>`;

    async function paint(html, name) {
      for (const vp of [1440, 375]) {
        for (const theme of ["light", "dark"]) {
          await page.setViewport({ ...SIZES[vp], deviceScaleFactor: 1 });
          await setTheme(page, theme);
          await page.evaluate((markup) => {
            const main = document.querySelector("main");
            if (main) main.innerHTML = markup;
          }, html);
          await shot(page, name, vp, theme, { reload: false, wait: 200 });
        }
      }
    }
    await paint(loadingHtml, "loading");
    await page.goto(`${BASE}/overview`, { waitUntil: "networkidle0", timeout: 60000 });
    await paint(errorHtml, "error");
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
