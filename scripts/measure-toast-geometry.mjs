/**
 * Fail if the error toast overlaps any interactive control at 375 / 390.
 *
 *   CHROME_PATH=/path/to/chrome pnpm test:toast-geometry
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { resolveChrome } from "./chrome-path.mjs";

const puppeteer = createRequire(import.meta.url)("puppeteer-core");
const WIDTHS = [375, 390];

const tokens = readFileSync(resolve("src/app/tokens.css"), "utf8").replace(/@import[^;]+;/g, "");
const components = readFileSync(resolve("src/app/components.css"), "utf8");
const globals = readFileSync(resolve("src/app/globals.css"), "utf8").replace(/@import[^;]+;/g, "");

const html = `<!doctype html>
<html lang="zh-Hant" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${tokens}
${globals}
${components}
body { margin: 0; }
</style>
</head>
<body>
  <div class="app-frame">
    <div class="tape" aria-label="市場行情"><a class="tape-cell" href="/holdings">NVDA</a></div>
    <div class="shell">
      <main class="main">
        <section class="card stack">
          <ul class="watch-list">
            <li class="watch-card">
              <div class="watch-card-head">NVDA</div>
              <div class="watch-actions">
                <button class="btn btn-secondary" type="button">靜音新聞</button>
                <button class="btn btn-ghost" type="button">取消關注</button>
              </div>
            </li>
          </ul>
        </section>
      </main>
      <nav class="mobile-bar" aria-label="手機導覽">
        <a href="/overview">總覽</a>
        <a href="/holdings">持倉</a>
        <a href="/entry">記帳</a>
      </nav>
    </div>
  </div>
  <div id="toast-host" class="toast-host" data-toast-host="">
    <div class="toast toast-error" role="alert" data-error-toast="">
      <span>更新失敗</span>
      <button class="btn btn-ghost btn-icon" type="button" aria-label="關閉">×</button>
    </div>
  </div>
</body>
</html>`;

function measure() {
  const toast = document.querySelector("[data-error-toast]");
  const toastBox = toast.getBoundingClientRect();
  const interactive = [...document.querySelectorAll("a, button, input, select, textarea")].filter((el) => {
    if (toast.contains(el)) {
      return false;
    }
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return rect.width >= 1 && rect.height >= 1 && cs.visibility !== "hidden" && cs.display !== "none";
  });
  const overlaps = interactive
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const hit =
        toastBox.left < rect.right &&
        toastBox.right > rect.left &&
        toastBox.top < rect.bottom &&
        toastBox.bottom > rect.top;
      return {
        text: (el.textContent ?? "").trim().slice(0, 24),
        hit,
        rect: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
      };
    })
    .filter((row) => row.hit);
  return {
    toast: { top: toastBox.top, left: toastBox.left, bottom: toastBox.bottom, right: toastBox.right },
    overlaps,
  };
}

const browser = await puppeteer.launch({
  executablePath: resolveChrome(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 812, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    const result = await page.evaluate(measure);
    await page.close();
    if (result.overlaps.length > 0) {
      console.error(`toast overlaps interactive controls at ${width}px`, result);
      process.exit(1);
    }
    console.log(`ok ${width} toast`, result.toast);
  }
} finally {
  await browser.close();
}
