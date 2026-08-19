#!/usr/bin/env node
/**
 * joint-ledger 本地自動更新（官方 GitHub Release overlay）
 *
 * Blocking 安全約束（必須全中）：
 * - pin 只准 KingHey2003/joint-ledger；唔跟 fork；唔讀 zip 內 repository 決定下次 URL
 * - 只 HTTPS；host allowlist 只准 api.github.com、codeload.github.com；唔關閉 TLS 驗證
 * - 只 official release tag（非 draft／prerelease）；唔拉 zipball/main、branch、PR ref
 * - stamp .jl-release = { tag, sha（該 tag commit SHA）, lastCheckAt, updatedAt }
 *   相同 tag+sha → skip；唔信 package.json version；overlay+install+migrate 成功先寫 stamp
 * - 解壓去 temp 再 copy 入現有根；解壓資料夾永遠唔當 cwd
 * - 永遠排除 data/、.env、.env.local、node_modules/、.next/、sqlite*、DATABASE_URL 指向嘅 file:
 * - zip-slip：拒 ..、絕對路徑、逃出 temp 嘅 symlink；zip／解壓有大小上限
 * - fail closed：失敗還原舊樹
 * - private：用現有 gh credential（env 或 `gh auth token`）；token 唔 commit、唔寫入任何檔、唔 echo log
 * - 成功後：pnpm install --ignore-scripts → rebuild onlyBuiltDependencies → pnpm db:migrate
 * - 唔 Electron、唔 download+eval
 *
 * 用法：
 *   node scripts/overlay-release.mjs              # 自動：lastCheckAt 滿 24h 先查
 *   node scripts/overlay-release.mjs --check      # 只檢查
 *   node scripts/overlay-release.mjs --force      # 人手強制（API / 按鈕）
 *   node scripts/overlay-release.mjs --apply      # 同 --force
 *
 * Exit: 0 最新或成功檢查；1 錯誤；10 成功 overlay，需要 restart
 */

import { createWriteStream, promises as fs } from 'node:fs';
import { join, resolve, relative, dirname, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';

const execFileAsync = promisify(execFile);

const PIN_OWNER = 'KingHey2003';
const PIN_REPO = 'joint-ledger';
const ALLOWED_HOSTS = new Set(['api.github.com', 'codeload.github.com']);
const STAMP_FILE = '.jl-release';
const LOCK_FILE = '.jl-update.lock';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ONLY_BUILT_DEPS = ['esbuild', 'libsql', 'sharp', 'unrs-resolver'];

const MAX_ZIP_BYTES = 80 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 200 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 40 * 1024 * 1024;

const EXCLUDE_DIRS = new Set(['data', 'node_modules', '.next', '.git']);
const EXCLUDE_FILES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  STAMP_FILE,
  LOCK_FILE,
  '.jl-need-restart',
]);
const SQLITE_RE = /\.sqlite(-journal|-wal|-shm)?$/i;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log('[overlay-release]', ...args.map(redactSecrets));
}
function err(...args) {
  console.error('[overlay-release]', ...args.map(redactSecrets));
}
function redactSecrets(v) {
  if (typeof v !== 'string') return v;
  return v
    .replace(/ghp_[A-Za-z0-9_]{20,}/g, 'ghp_***')
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, 'github_pat_***')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer ***');
}

function getToken() {
  for (const key of ['JL_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) {
    const t = process.env[key];
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  try {
    const r = spawnSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    if (r.status === 0 && r.stdout && r.stdout.trim()) {
      return r.stdout.trim();
    }
  } catch {
    /* gh missing */
  }
  return '';
}

function assertHttpsUrl(urlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL: ${urlStr}`);
  }
  if (u.protocol !== 'https:') {
    throw new Error(`Only HTTPS allowed, got ${u.protocol}`);
  }
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    throw new Error(`Host not in allowlist: ${u.hostname}`);
  }
  const path = u.pathname.toLowerCase();
  if (
    /\/zipball\/(main|master|head)(\/|$)/i.test(path) ||
    /\/tarball\/(main|master|head)(\/|$)/i.test(path) ||
    /\/pull\/\d+/i.test(path) ||
    /\/merge\//i.test(path)
  ) {
    throw new Error(`Reject non-release ref in URL: ${u.pathname}`);
  }
  return u;
}

async function safeFetch(urlStr, opts = {}) {
  const u = assertHttpsUrl(urlStr);
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token && u.hostname === 'api.github.com') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (u.hostname === 'api.github.com') {
    headers['Accept'] = headers['Accept'] || 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
  }
  headers['User-Agent'] = headers['User-Agent'] || 'joint-ledger-overlay/1.0';
  const res = await fetch(u.toString(), {
    ...opts,
    headers,
    redirect: 'manual',
  });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get('location');
    if (!loc) throw new Error('Redirect without Location');
    const next = new URL(loc, u).toString();
    assertHttpsUrl(next);
    return safeFetch(next, { ...opts, redirect: 'manual' });
  }
  return res;
}

async function readStamp() {
  try {
    const raw = await fs.readFile(join(ROOT, STAMP_FILE), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeStamp(data) {
  const p = join(ROOT, STAMP_FILE);
  const tmp = p + '.tmp.' + randomBytes(4).toString('hex');
  const payload = {
    tag: data.tag,
    sha: data.sha,
    lastCheckAt: data.lastCheckAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
  if (data.name) payload.name = data.name;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, p);
}

async function touchLastCheckAt() {
  const cur = (await readStamp()) || {};
  const next = {
    tag: cur.tag || null,
    sha: cur.sha || null,
    lastCheckAt: new Date().toISOString(),
    updatedAt: cur.updatedAt || null,
  };
  if (cur.name) next.name = cur.name;
  const p = join(ROOT, STAMP_FILE);
  const tmp = p + '.tmp.' + randomBytes(4).toString('hex');
  await fs.writeFile(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, p);
}

async function acquireLock() {
  const p = join(ROOT, LOCK_FILE);
  try {
    const fh = await fs.open(p, 'wx');
    await fh.writeFile(String(process.pid) + '\n' + new Date().toISOString() + '\n');
    await fh.close();
    return async () => {
      try {
        await fs.unlink(p);
      } catch {}
    };
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      throw new Error('Another overlay is in progress (lock held)');
    }
    throw e;
  }
}

function shouldExclude(relPath) {
  const parts = relPath.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0) return true;
  const top = parts[0];
  if (EXCLUDE_DIRS.has(top)) return true;
  if (parts.length === 1 && EXCLUDE_FILES.has(top)) return true;
  if (SQLITE_RE.test(basename(relPath))) return true;
  if (top === STAMP_FILE || top === LOCK_FILE) return true;
  return false;
}

async function protectedSqlitePaths() {
  const out = new Set();
  try {
    const envRaw = await fs.readFile(join(ROOT, '.env'), 'utf8').catch(() => '');
    const m = envRaw.match(/^DATABASE_URL\s*=\s*(.+)$/m);
    if (m) {
      let v = m[1].trim().replace(/^["']|["']$/g, '');
      if (v.startsWith('file:')) {
        const p = v.slice('file:'.length);
        const abs = resolve(ROOT, p);
        out.add(abs);
        out.add(resolve(ROOT, relative(ROOT, abs)));
      }
    }
  } catch {
    /* ignore */
  }
  out.add(resolve(ROOT, 'data/joint-ledger.sqlite'));
  return out;
}

function safeExtractPath(destRoot, entryName) {
  let name = String(entryName).replace(/\\/g, '/');
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) {
    throw new Error(`zip-slip: absolute path rejected: ${entryName}`);
  }
  if (name.split('/').some((p) => p === '..')) {
    throw new Error(`zip-slip: .. rejected: ${entryName}`);
  }
  const target = resolve(destRoot, name);
  const rel = relative(destRoot, target);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`zip-slip: path escapes root: ${entryName}`);
  }
  return target;
}

async function assertExtractSafe(extractRoot) {
  let total = 0;
  async function walk(dir) {
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of list) {
      const full = join(dir, ent.name);
      if (ent.isSymbolicLink()) {
        const link = await fs.readlink(full);
        if (isAbsolute(link) || link.split(/[/\\]/).includes('..')) {
          throw new Error(`zip-slip: escaping symlink rejected: ${full} -> ${link}`);
        }
        const resolved = resolve(dir, link);
        const rel = relative(extractRoot, resolved);
        if (rel.startsWith('..') || isAbsolute(rel)) {
          throw new Error(`zip-slip: symlink escapes temp: ${full} -> ${link}`);
        }
      } else if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        const st = await fs.stat(full);
        if (st.size > MAX_SINGLE_FILE_BYTES) {
          throw new Error(`Extracted file too large: ${full} (${st.size} bytes)`);
        }
        total += st.size;
        if (total > MAX_EXTRACTED_BYTES) {
          throw new Error(`Extracted total exceeds limit (${MAX_EXTRACTED_BYTES} bytes)`);
        }
      }
    }
  }
  await walk(extractRoot);
  return total;
}

async function downloadToFile(url, destPath) {
  const res = await safeFetch(url, {
    headers: { Accept: 'application/octet-stream' },
  });
  if (!res.ok) {
    throw new Error(`Download failed ${res.status}`);
  }
  const len = res.headers.get('content-length');
  if (len && Number(len) > MAX_ZIP_BYTES) {
    throw new Error(`Zip too large: ${len} bytes (max ${MAX_ZIP_BYTES})`);
  }
  const body = res.body;
  if (!body) throw new Error('No body');
  const ws = createWriteStream(destPath);
  let written = 0;
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      written += value.byteLength;
      if (written > MAX_ZIP_BYTES) {
        ws.destroy();
        throw new Error(`Zip download exceeded limit (${MAX_ZIP_BYTES} bytes)`);
      }
      if (!ws.write(Buffer.from(value))) {
        await new Promise((r) => ws.once('drain', r));
      }
    }
    await new Promise((r, j) => {
      ws.end(() => r());
      ws.on('error', j);
    });
  } catch (e) {
    try {
      await fs.unlink(destPath);
    } catch {}
    throw e;
  }
}

async function extractZip(zipPath, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  if (platform() === 'win32') {
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { maxBuffer: 20 * 1024 * 1024 }
    );
  } else {
    try {
      await execFileAsync('unzip', ['-q', '-o', zipPath, '-d', destDir], {
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (e) {
      try {
        await execFileAsync('bsdtar', ['-xf', zipPath, '-C', destDir]);
      } catch {
        throw new Error('需要 unzip 或 bsdtar。' + (e && e.message ? e.message : String(e)));
      }
    }
  }
}

async function overlayFromExtracted(extractedRoot, protectedPaths) {
  const entries = await fs.readdir(extractedRoot, { withFileTypes: true });
  let srcRoot = extractedRoot;
  if (entries.length === 1 && entries[0].isDirectory()) {
    srcRoot = join(extractedRoot, entries[0].name);
  }
  async function walk(src, relBase = '') {
    const list = await fs.readdir(src, { withFileTypes: true });
    for (const ent of list) {
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (shouldExclude(rel)) continue;
      const srcPath = join(src, ent.name);
      const destPath = join(ROOT, rel);
      if (protectedPaths.has(resolve(destPath))) continue;
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await walk(srcPath, rel);
      } else if (ent.isFile()) {
        safeExtractPath(ROOT, rel);
        await fs.mkdir(dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
  await walk(srcRoot);
}

async function restoreFromBackup(backupDir, protectedPaths) {
  log('Fail-closed: restoring from backup...');
  async function walk(src, relBase = '') {
    const list = await fs.readdir(src, { withFileTypes: true });
    for (const ent of list) {
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (shouldExclude(rel)) continue;
      const srcPath = join(src, ent.name);
      const destPath = join(ROOT, rel);
      if (protectedPaths.has(resolve(destPath))) continue;
      if (ent.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await walk(srcPath, rel);
      } else if (ent.isFile()) {
        await fs.mkdir(dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
  await walk(backupDir);
  log('Restore complete.');
}

async function createBackup(backupDir, protectedPaths) {
  await fs.mkdir(backupDir, { recursive: true });
  async function walk(src, relBase = '') {
    let list;
    try {
      list = await fs.readdir(src, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of list) {
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (shouldExclude(rel)) continue;
      const srcPath = join(src, ent.name);
      const destPath = join(backupDir, rel);
      if (protectedPaths.has(resolve(srcPath))) continue;
      if (ent.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await walk(srcPath, rel);
      } else if (ent.isFile()) {
        await fs.mkdir(dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
  await walk(ROOT);
}

async function runPnpmInstallRebuildMigrate() {
  log('pnpm install --ignore-scripts ...');
  execFileSync('pnpm', ['install', '--ignore-scripts'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
  log('pnpm rebuild', ONLY_BUILT_DEPS.join(' '), '...');
  try {
    execFileSync('pnpm', ['rebuild', ...ONLY_BUILT_DEPS], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch (e) {
    err('pnpm rebuild warning:', e && e.message ? e.message : e);
  }
  log('pnpm db:migrate ...');
  try {
    execFileSync('pnpm', ['db:migrate'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch (e) {
    try {
      execFileSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env },
      });
    } catch (e2) {
      throw new Error(
        'db:migrate failed: ' + ((e2 && e2.message) || (e && e.message) || e2 || e)
      );
    }
  }
}

function validateReleasePayload(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid release payload');
  }
  if (data.draft === true) throw new Error('Reject draft release');
  if (data.prerelease === true) throw new Error('Reject prerelease');
  if (!data.tag_name || typeof data.tag_name !== 'string') {
    throw new Error('Release missing tag_name');
  }
  const tag = data.tag_name;
  if (tag === 'main' || tag === 'master' || tag === 'HEAD') {
    throw new Error('Reject non-release tag (main/master)');
  }
  if (/^refs\//i.test(tag) || /^pull\//i.test(tag)) {
    throw new Error('Reject non-release ref tag');
  }
  const zipball = data.zipball_url;
  if (!zipball || typeof zipball !== 'string') {
    throw new Error('Release missing zipball_url');
  }
  assertHttpsUrl(zipball);
  return {
    tag,
    name: data.name || tag,
    zipball_url: zipball,
    published_at: data.published_at,
    id: data.id,
  };
}

async function resolveTagSha(tag) {
  const refUrl = `https://api.github.com/repos/${PIN_OWNER}/${PIN_REPO}/git/ref/tags/${encodeURIComponent(tag)}`;
  try {
    const res = await safeFetch(refUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.object && data.object.sha) {
        if (data.object.type === 'commit') {
          return data.object.sha;
        }
        if (data.object.type === 'tag') {
          const tagObjUrl = `https://api.github.com/repos/${PIN_OWNER}/${PIN_REPO}/git/tags/${data.object.sha}`;
          const tRes = await safeFetch(tagObjUrl);
          if (tRes.ok) {
            const tData = await tRes.json();
            if (tData.object && tData.object.sha) return tData.object.sha;
          }
        }
      }
    }
  } catch {
    /* fall through */
  }
  const commitUrl = `https://api.github.com/repos/${PIN_OWNER}/${PIN_REPO}/commits/${encodeURIComponent(tag)}`;
  const cRes = await safeFetch(commitUrl);
  if (!cRes.ok) {
    throw new Error(`Cannot resolve commit SHA for tag ${tag}`);
  }
  const cData = await cRes.json();
  if (!cData.sha || typeof cData.sha !== 'string') {
    throw new Error(`Commit payload missing sha for tag ${tag}`);
  }
  return cData.sha;
}

async function getLatestOfficialRelease() {
  if (
    (process.env.JL_REPO_OWNER && process.env.JL_REPO_OWNER !== PIN_OWNER) ||
    (process.env.JL_REPO_NAME && process.env.JL_REPO_NAME !== PIN_REPO)
  ) {
    throw new Error(`Repo pin violation: only ${PIN_OWNER}/${PIN_REPO} allowed`);
  }
  const url = `https://api.github.com/repos/${PIN_OWNER}/${PIN_REPO}/releases/latest`;
  const res = await safeFetch(url);
  if (res.status === 404) {
    throw new Error('No official release found (or repo inaccessible)');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${redactSecrets(text.slice(0, 200))}`);
  }
  const data = await res.json();
  const base = validateReleasePayload(data);
  const sha = await resolveTagSha(base.tag);
  return { ...base, sha };
}

async function doOverlay(release) {
  const token = randomBytes(6).toString('hex');
  const workDir = join(tmpdir(), `jl-overlay-${token}`);
  const zipPath = join(workDir, 'release.zip');
  const extractDir = join(workDir, 'extract');
  const backupDir = join(workDir, 'backup');
  const protectedPaths = await protectedSqlitePaths();
  let releaseLock = null;
  try {
    releaseLock = await acquireLock();
    await fs.mkdir(workDir, { recursive: true });
    log(`Downloading official tag ${release.tag} (sha ${release.sha.slice(0, 12)}) ...`);
    await downloadToFile(release.zipball_url, zipPath);
    log('Extracting to temp (not cwd) ...');
    await extractZip(zipPath, extractDir);
    await assertExtractSafe(extractDir);
    const topEntries = await fs.readdir(extractDir);
    if (topEntries.length === 1) {
      const m = topEntries[0].match(/-([0-9a-f]{7,40})$/i);
      if (m && release.sha && !release.sha.startsWith(m[1]) && !m[1].startsWith(release.sha.slice(0, m[1].length))) {
        log('Note: zip folder sha prefix differs from resolved tag sha (using API sha)');
      }
    }
    log('Creating backup (fail-closed) ...');
    await createBackup(backupDir, protectedPaths);
    log('Copy from temp into existing root (exclude data/.env/sqlite/node_modules/.next) ...');
    try {
      await overlayFromExtracted(extractDir, protectedPaths);
    } catch (overlayErr) {
      err('Overlay failed, restoring...', overlayErr && overlayErr.message);
      await restoreFromBackup(backupDir, protectedPaths);
      throw overlayErr;
    }
    try {
      await runPnpmInstallRebuildMigrate();
    } catch (postErr) {
      err('Post-overlay install/migrate failed, restoring...', postErr && postErr.message);
      await restoreFromBackup(backupDir, protectedPaths);
      throw postErr;
    }
    const stamp = {
      tag: release.tag,
      sha: release.sha,
      lastCheckAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: release.name,
    };
    await writeStamp(stamp);
    log('Stamp written after success:', stamp.tag, stamp.sha.slice(0, 12));
    log('Overlay success. Restart required.');
    return { ok: true, stamp, needRestart: true };
  } finally {
    if (releaseLock) await releaseLock();
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {}
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has('--check');
  const force = args.has('--force') || args.has('--apply');
  const fromApi = args.has('--from-api') || process.env.JL_FROM_API === '1';
  const stamp = await readStamp();
  const now = Date.now();
  const lastCheck = stamp?.lastCheckAt ? Date.parse(stamp.lastCheckAt) : 0;
  const age = now - lastCheck;
  if (!force && !checkOnly && age < CHECK_INTERVAL_MS && lastCheck > 0) {
    log(`Skip auto-check (lastCheckAt ${stamp.lastCheckAt}, age ${Math.round(age / 3600000)}h < 24h)`);
    process.exit(0);
  }
  let release;
  try {
    release = await getLatestOfficialRelease();
  } catch (e) {
    err('Failed to fetch latest release:', e && e.message ? e.message : e);
    await touchLastCheckAt().catch(() => {});
    process.exit(1);
  }
  await touchLastCheckAt();
  if (stamp?.tag && stamp?.sha && stamp.tag === release.tag && stamp.sha === release.sha) {
    log(`Already on latest official: ${release.tag} @ ${release.sha.slice(0, 12)}`);
    process.exit(0);
  }
  if (checkOnly) {
    log(`Update available: ${stamp?.tag || '(none)'} → ${release.tag} @ ${release.sha.slice(0, 12)}`);
    process.exit(0);
  }
  log(`Applying overlay: ${stamp?.tag || '(none)'} → ${release.tag} @ ${release.sha.slice(0, 12)}`);
  try {
    const result = await doOverlay(release);
    if (result.needRestart) {
      if (fromApi) {
        await fs.writeFile(join(ROOT, '.jl-need-restart'), release.tag + '\n' + release.sha + '\n', 'utf8');
      }
      process.exit(10);
    }
    process.exit(0);
  } catch (e) {
    err('Overlay failed:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

export {
  assertHttpsUrl,
  safeExtractPath,
  shouldExclude,
  validateReleasePayload,
  getLatestOfficialRelease,
  ALLOWED_HOSTS,
  PIN_OWNER,
  PIN_REPO,
  STAMP_FILE,
  MAX_ZIP_BYTES,
  MAX_EXTRACTED_BYTES,
};

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('overlay-release.mjs') ||
    process.argv[1].includes('overlay-release'));
if (isMain) {
  main().catch((e) => {
    err(e);
    process.exit(1);
  });
}
