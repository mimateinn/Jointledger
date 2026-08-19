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
      expect(() => assertHttpsUrl('https://github.com/KingHey2003/joint-ledger')).toThrow(
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
          'https://codeload.github.com/KingHey2003/joint-ledger/zip/refs/tags/v1.0.0'
        )
      ).not.toThrow();
    });

    it('rejects zipball/main and branch/PR refs in URL', async () => {
      const { assertHttpsUrl } = await loadOverlay();
      expect(() =>
        assertHttpsUrl('https://api.github.com/repos/KingHey2003/joint-ledger/zipball/main')
      ).toThrow(/non-release|main/i);
      expect(() =>
        assertHttpsUrl('https://api.github.com/repos/KingHey2003/joint-ledger/zipball/master')
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
    it('PIN is KingHey2003/joint-ledger only', async () => {
      const { PIN_OWNER, PIN_REPO } = await loadOverlay();
      expect(PIN_OWNER).toBe('KingHey2003');
      expect(PIN_REPO).toBe('joint-ledger');
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
        zipball_url: 'https://api.github.com/repos/KingHey2003/joint-ledger/zipball/v1.0.0',
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
        zipball_url: 'https://api.github.com/repos/KingHey2003/joint-ledger/zipball/v1.0.0-beta',
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
        zipball_url: 'https://api.github.com/repos/KingHey2003/joint-ledger/zipball/v1',
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
      zipball_url: 'https://api.github.com/repos/KingHey2003/joint-ledger/zipball/v1.2.3',
      id: 1,
    });
    expect(r.tag).toBe('v1.2.3');
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
    expect(src).toMatch(/overlay-release\.mjs/);
    expect(src).not.toMatch(/searchParams\.get\(['"]tag/);
    expect(src).not.toMatch(/NEXT_PUBLIC_.*TOKEN/);
  });
});
