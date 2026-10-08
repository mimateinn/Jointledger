/**
 * Fail if 3 undo toasts + 1 error overlap controls, or if any undo is hidden.
 *
 *   CHROME_PATH=/path/to/chrome SHOT_BASE=http://127.0.0.1:3002 pnpm test:toast-geometry
 */
import { createRequire } from "node:module";
import { resolveChrome } from "./chrome-path.mjs";

const puppeteer = createRequire(import.meta.url)("puppeteer-core");
const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const USER = process.env.SHOT_USER ?? "Member A";
const PASS = process.env.SHOT_PASS ?? "demo-pass-1";
const WIDTHS = [360, 375, 414, 1440];

function injectToasts() {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    host.dataset.toastHost = "";
    document.body.appendChild(host);
  }
  host.replaceChildren();
  for (const label of ["列 A", "列 B", "列 C"]) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("data-undo-toast", "");
    toast.innerHTML = `<span>已刪除・還原</span><span class="toast-label">${label}</span><button class="btn btn-secondary" type="button" aria-label="還原 ${label}">還原</button>`;
    host.appendChild(toast);
  }
  const error = document.createElement("div");
  error.className = "toast toast-error";
  error.setAttribute("data-error-toast", "");
  error.setAttribute("role", "alert");
  error.innerHTML = `<span>更新失敗</span><button class="btn btn-ghost btn-icon" type="button" aria-label="關閉">×</button>`;
  host.appendChild(error);
}

function measure() {
  const toasts = [...document.querySelectorAll("[data-undo-toast], [data-error-toast]")];
  const visible = toasts.filter((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return rect.height >= 1 && cs.display !== "none" && cs.visibility !== "hidden";
  });
  const toastBoxes = visible.map((el) => el.getBoundingClientRect());
  const host = document.querySelector("[data-toast-host], #toast-host");
  const hostBox = host?.getBoundingClientRect();
  const toastArea =
    hostBox && hostBox.height >= 1
      ? hostBox
      : toastBoxes.reduce(
          (acc, rect) => ({
            top: Math.min(acc.top, rect.top),
            left: Math.min(acc.left, rect.left),
            bottom: Math.max(acc.bottom, rect.bottom),
            right: Math.max(acc.right, rect.right),
          }),
          { top: Infinity, left: Infinity, bottom: 0, right: 0 },
        );
  const interactive = [...document.querySelectorAll("a, button, input, select, textarea")].filter((el) => {
    if (toasts.some((toast) => toast.contains(el))) {
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
        toastArea.left < rect.right &&
        toastArea.right > rect.left &&
        toastArea.top < rect.bottom &&
        toastArea.bottom > rect.top;
      return {
        text: (el.textContent ?? "").trim().slice(0, 24),
        hit,
      };
    })
    .filter((row) => row.hit);
  const undo = [...document.querySelectorAll("[data-undo-toast]")].map((el) => {
    const cs = getComputedStyle(el);
    const button = el.querySelector("button");
    const btnCs = button ? getComputedStyle(button) : null;
    return {
      display: cs.display,
      height: el.getBoundingClientRect().height,
      buttonDisplay: btnCs?.display ?? "missing",
    };
  });
  return {
    visibleCount: visible.length,
    undoHidden: undo.filter((row) => row.display === "none" || row.height < 1 || row.buttonDisplay === "none").length,
    toast: {
      top: toastArea.top,
      left: toastArea.left,
      bottom: toastArea.bottom,
      right: toastArea.right,
    },
    overlaps,
  };
}

const browser = await puppeteer.launch({
  executablePath: resolveChrome(),
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await page.type("#identifier", USER);
  await page.type("#password", PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")]);

  for (const width of WIDTHS) {
    await page.setViewport({ width, height: width >= 800 ? 900 : 812, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/holdings`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "關注")?.click();
    });
    await page.waitForSelector(".watch-list .watch-actions .btn, main.main", { timeout: 15000 });
    await page.evaluate(injectToasts);
    const result = await page.evaluate(measure);
    if (result.visibleCount < 4 || result.undoHidden > 0) {
      console.error(`hidden undo/error toasts at ${width}px`, result);
      process.exit(1);
    }
    if (result.overlaps.length > 0) {
      console.error(`toast overlaps interactive controls at ${width}px`, result);
      process.exit(1);
    }
    console.log(`ok ${width} stacked=${result.visibleCount}`, result.toast);
  }
} finally {
  await browser.close();
}
