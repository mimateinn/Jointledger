import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./data/test-ledger.sqlite",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
