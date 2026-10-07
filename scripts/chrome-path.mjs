import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/opt/google/chrome/chrome",
  "/usr/local/bin/google-chrome",
  "/usr/local/bin/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

export function resolveChrome() {
  for (const candidate of CANDIDATES) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  const puppeteer = createRequire(import.meta.url)("puppeteer-core");
  if (typeof puppeteer.executablePath === "function") {
    try {
      const resolved = puppeteer.executablePath();
      if (resolved && existsSync(resolved)) {
        return resolved;
      }
    } catch {
      /* fall through */
    }
  }
  throw new Error("No Chrome binary. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH to a Chromium executable.");
}
