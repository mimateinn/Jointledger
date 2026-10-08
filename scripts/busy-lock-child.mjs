/**
 * Hold a SQLite write lock from a live child using native libsql.
 * BEGIN IMMEDIATE + a real write, process stays alive, hold > busy_timeout (5s).
 *
 *   node scripts/busy-lock-child.mjs <file-url-or-path> [holdMs]
 */
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);

function loadNativeLibsql() {
  try {
    return require("libsql");
  } catch {
    const clientDir = dirname(require.resolve("@libsql/client/package.json"));
    return require(require.resolve("libsql", { paths: [clientDir] }));
  }
}

const Database = loadNativeLibsql();
const raw = process.argv[2];
if (!raw) {
  process.stderr.write("usage: node scripts/busy-lock-child.mjs <db-path> [holdMs]\n");
  process.exit(2);
}
const dbPath = raw.replace(/^file:/, "");
const holdMs = Number(process.argv[3] ?? 7500);
if (!Number.isFinite(holdMs) || holdMs <= 5000) {
  process.stderr.write("holdMs must be greater than 5000\n");
  process.exit(2);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 0");
db.exec("BEGIN IMMEDIATE");
db.exec("UPDATE watch_items SET muted = muted");
process.stdout.write("LOCKED\n");

const deadline = Date.now() + holdMs;
const keepAlive = setInterval(() => {
  if (Date.now() < deadline) {
    return;
  }
  clearInterval(keepAlive);
  try {
    db.exec("COMMIT");
    process.stdout.write("RELEASED\n");
  } catch (error) {
    process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
  } finally {
    db.close();
    process.exit(0);
  }
}, 100);

function abort() {
  clearInterval(keepAlive);
  try {
    db.exec("ROLLBACK");
  } catch {
    // already closed
  }
  try {
    db.close();
  } catch {
    // already closed
  }
  process.exit(0);
}

process.on("SIGTERM", abort);
process.on("SIGINT", abort);
