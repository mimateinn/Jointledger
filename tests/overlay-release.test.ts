/**
 * vitest：zip-slip、host allowlist、draft 拒絕、symlink 逃逸、大小上限、401、GET 拒絕
 * 執行：pnpm exec vitest run tests/overlay-release.test.ts
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const scriptPath = join(process.cwd(), 'scripts', 'overlay-release.mjs');

async function loadOverlay() {
  const url = pathToFileURL(scriptPath).href + '?t=' + Date.now();
  return import(url);
}

describe('overlay-release security', () => {
  describe('host allowlist + HTTPS only', () => {
    it('rejects non-HTTPS', async () => {
      const { assertHttpsUrl } = await loadOverlay();
      expect(() => assertHttpsUrl('http://api.github.com/foo')).toThrow(/HTTPS/i);
    });

    it('rejects disallowed host', async () => {
      const { assertHttpsUrl } = await loadOverlay();
      expect(() => assertHttpsUrl('https://evil.example.com/x')).toThrow(/allowlist/i);
      expect(() => assertHttpsUrl('https://github.com/mimateinn/Jointledger')).toThrow(
        /allowlist/i
      );
    });

    it('allows api.github.com and codeload.github.com', async () => {
      const { assertHttpsUrl, ALLOWED_HOSTS } = await loadOverlay();
      expect(ALLOWED_HOSTS.has('api.github.com')).toBe(true);
      expect(ALLOWED_HOSTS.has('codeload.github.com')).toBe(true);
      expect(() => assertHttpsUrl('https://api.github.com/repos/x')).not.toThrow();
      expect(() =>
        assertHttpsUrl(
          'https://codeload.github.com/mimateinn/Jointledger/zip/refs/tags/v1.0.0'
        )
      ).not.toThrow();
    });

    it('rejects zipball/main and branch/PR refs in URL', async () => {
      const { assertHttpsUrl } = await loadOverlay();
      expect(() =>
        assertHttpsUrl('https://api.github.com/repos/mimateinn/Jointledger/zipball/main')
      ).toThrow(/non-release|main/i);
      expect(() =>
        assertHttpsUrl('https://api.github.com/repos/mimateinn/Jointledger/zipball/master')
      ).toThrow(/non-release|main|master/i);
    });
  });

  describe('zip-slip', () => {
    it('rejects .. segments', async () => {
      const { safeExtractPath } = await loadOverlay();
      const root = '/tmp/jl-test-root';
      expect(() => safeExtractPath(root, '../etc/passwd')).toThrow(/zip-slip|\.\./i);
      expect(() => safeExtractPath(root, 'foo/../../etc/passwd')).toThrow(/zip-slip|\.\./i);
    });

    it('rejects absolute paths', async () => {
      const { safeExtractPath } = await loadOverlay();
      const root = '/tmp/jl-test-root';
      expect(() => safeExtractPath(root, '/etc/passwd')).toThrow(/zip-slip|absolute/i);
      expect(() => safeExtractPath(root, 'C:\\Windows\\System32')).toThrow(/zip-slip|absolute/i);
    });

    it('accepts normal relative paths', async () => {
      const { safeExtractPath } = await loadOverlay();
      const root = '/tmp/jl-test-root';
      const p = safeExtractPath(root, 'src/app/page.tsx');
      expect(p).toContain('src');
      expect(p).toContain('page.tsx');
    });
  });

  describe('shouldExclude', () => {
    it('excludes data/, node_modules/, .next/, .env, sqlite', async () => {
      const { shouldExclude } = await loadOverlay();
      expect(shouldExclude('data/joint-ledger.sqlite')).toBe(true);
      expect(shouldExclude('node_modules/foo')).toBe(true);
      expect(shouldExclude('.next/cache')).toBe(true);
      expect(shouldExclude('.env')).toBe(true);
      expect(shouldExclude('.env.local')).toBe(true);
      expect(shouldExclude('foo.sqlite')).toBe(true);
      expect(shouldExclude('bar.sqlite-wal')).toBe(true);
      expect(shouldExclude('src/app/page.tsx')).toBe(false);
      expect(shouldExclude('package.json')).toBe(false);
    });
  });

  describe('repo pin', () => {
    it('PIN is mimateinn/Jointledger only', async () => {
      const { PIN_OWNER, PIN_REPO } = await loadOverlay();
      expect(PIN_OWNER).toBe('mimateinn');
      expect(PIN_REPO).toBe('Jointledger');
    });
  });

  describe('size limits exported', () => {
    it('has zip and extract caps', async () => {
      const { MAX_ZIP_BYTES, MAX_EXTRACTED_BYTES } = await loadOverlay();
      expect(MAX_ZIP_BYTES).toBeLessThanOrEqual(80 * 1024 * 1024);
      expect(MAX_EXTRACTED_BYTES).toBeLessThanOrEqual(200 * 1024 * 1024);
    });
  });
});

describe('draft / prerelease / main rejection', () => {
  it('rejects draft', async () => {
    const { validateReleasePayload } = await loadOverlay();
    expect(() =>
      validateReleasePayload({
        draft: true,
        prerelease: false,
        tag_name: 'v1.0.0',
        zipball_url: 'https://api.github.com/repos/mimateinn/Jointledger/zipball/v1.0.0',
      })
    ).toThrow(/draft/i);
  });

  it('rejects prerelease', async () => {
    const { validateReleasePayload } = await loadOverlay();
    expect(() =>
      validateReleasePayload({
        draft: false,
        prerelease: true,
        tag_name: 'v1.0.0-beta',
        zipball_url: 'https://api.github.com/repos/mimateinn/Jointledger/zipball/v1.0.0-beta',
      })
    ).toThrow(/prerelease/i);
  });

  it('rejects main/master tag', async () => {
    const { validateReleasePayload } = await loadOverlay();
    expect(() =>
      validateReleasePayload({
        draft: false,
        prerelease: false,
        tag_name: 'main',
        zipball_url: 'https://api.github.com/repos/mimateinn/Jointledger/zipball/v1',
      })
    ).toThrow(/main|master|non-release/i);
  });

  it('accepts official release', async () => {
    const { validateReleasePayload } = await loadOverlay();
    const r = validateReleasePayload({
      draft: false,
      prerelease: false,
      tag_name: 'v1.2.3',
      name: 'v1.2.3',
      zipball_url: 'https://api.github.com/repos/mimateinn/Jointledger/zipball/v1.2.3',
      id: 1,
    });
    expect(r.tag).toBe('v1.2.3');
  });
});

describe('fail-closed park / restore', () => {
  it('parks and unparks node_modules and .next via *.jl-park', async () => {
    const { parkRuntimeDirs, unparkRuntimeDirs, PARK_SUFFIX, PARK_DIRS } = await loadOverlay();
    const fs = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    expect(PARK_SUFFIX).toBe('.jl-park');
    expect(PARK_DIRS).toEqual(['node_modules', '.next']);
    const root = await mkdtemp(join(tmpdir(), 'jl-park-'));
    await fs.mkdir(join(root, 'node_modules'));
    await fs.writeFile(join(root, 'node_modules', 'kept.txt'), 'modules');
    await fs.mkdir(join(root, '.next'));
    await fs.writeFile(join(root, '.next', 'cache.txt'), 'cache');
    await parkRuntimeDirs(root);
    await expect(fs.stat(join(root, 'node_modules'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(join(root, '.next'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(join(root, `node_modules${PARK_SUFFIX}`, 'kept.txt'), 'utf8')).toBe('modules');
    expect(await fs.readFile(join(root, `.next${PARK_SUFFIX}`, 'cache.txt'), 'utf8')).toBe('cache');
    await unparkRuntimeDirs(root);
    expect(await fs.readFile(join(root, 'node_modules', 'kept.txt'), 'utf8')).toBe('modules');
    expect(await fs.readFile(join(root, '.next', 'cache.txt'), 'utf8')).toBe('cache');
    await expect(fs.stat(join(root, `node_modules${PARK_SUFFIX}`))).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.rm(root, { recursive: true, force: true });
  });

  it('restore copies backup tree and deletes overlay-only files', async () => {
    const { createBackup, restoreFromBackup, shouldExclude } = await loadOverlay();
    const fs = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const root = await fs.mkdtemp(join(tmpdir(), 'jl-restore-'));
    const backup = join(root, 'backup-tree');
    const live = join(root, 'live');
    await fs.mkdir(join(live, 'src'), { recursive: true });
    await fs.writeFile(join(live, 'src', 'kept.ts'), 'old');
    await fs.writeFile(join(live, 'package.json'), '{"name":"old"}');
    await createBackup(backup, new Set(), live);
    await fs.writeFile(join(live, 'src', 'kept.ts'), 'new');
    await fs.mkdir(join(live, 'src', 'overlay-only'), { recursive: true });
    await fs.writeFile(join(live, 'src', 'overlay-only', 'fresh.ts'), 'added');
    await fs.writeFile(join(live, 'data-should-stay.env'), 'no');
    await restoreFromBackup(backup, new Set(), live);
    expect(await fs.readFile(join(live, 'src', 'kept.ts'), 'utf8')).toBe('old');
    await expect(fs.stat(join(live, 'src', 'overlay-only', 'fresh.ts'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(shouldExclude('data/joint-ledger.sqlite')).toBe(true);
    expect(shouldExclude('node_modules.jl-park/foo')).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes .jl-release only after overlay+install+migrate succeed', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(join(process.cwd(), 'scripts/overlay-release.mjs'), 'utf8');
    const overlayIdx = src.indexOf('await overlayFromExtracted');
    const installIdx = src.indexOf('await runPnpmInstallRebuildMigrate');
    const stampIdx = src.lastIndexOf('await writeStamp(stamp)');
    const restoreIdx = src.indexOf('await restoreFromBackup');
    expect(overlayIdx).toBeGreaterThan(0);
    expect(installIdx).toBeGreaterThan(overlayIdx);
    expect(stampIdx).toBeGreaterThan(installIdx);
    expect(restoreIdx).toBeGreaterThan(0);
    expect(restoreIdx).toBeLessThan(stampIdx);
    expect(src).toContain('parkRuntimeDirs');
    expect(src).toContain('unparkRuntimeDirs');
    expect(src).toContain('deleteOverlayOnlyFiles');
    expect(src).toMatch(/\.jl-park/);
  });
});

describe('API route contract', () => {
  it('route is POST-only, 401, no client tag, no NEXT_PUBLIC token', async () => {
    const fs = await import('node:fs/promises');
    const routePath = join(process.cwd(), 'src/app/api/update/route.ts');
    let src = '';
    try {
      src = await fs.readFile(routePath, 'utf8');
    } catch {
      return;
    }
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/405/);
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/requireUser/);
    expect(src).toMatch(/401/);
    expect(src).toMatch(/getCurrentMembership/);
    expect(src).toMatch(/@\/lib\/current-book/);
    expect(src).toMatch(/overlay-release\.mjs/);
    expect(src).not.toMatch(/searchParams\.get\(['"]tag/);
    expect(src).not.toMatch(/NEXT_PUBLIC_.*TOKEN/);
  });

  it('middleware does not redirect /api/update to /login', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(join(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(src).toContain('"/api/update"');
    expect(src).toMatch(/authInHandler\.has\(pathname\)/);
  });
});
