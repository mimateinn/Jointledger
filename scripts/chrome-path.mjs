import { createRequire } from "node:module";

export function resolveChrome() {
  const fromEnv = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) {
    return fromEnv;
  }
  const puppeteer = createRequire(import.meta.url)("puppeteer-core");
  if (typeof puppeteer.executablePath === "function") {
    try {
      const resolved = puppeteer.executablePath();
      if (resolved) {
        return resolved;
      }
    } catch {
      /* fall through */
    }
  }
  throw new Error("No Chrome binary. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH to a Chromium executable.");
}
