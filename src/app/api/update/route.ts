/**
 * POST /api/update
 * 人手觸發官方 Release overlay（共用 scripts/overlay-release.mjs）
 *
 * 安全：
 * - 只准 POST（GET → 405）
 * - requireUser() + getCurrentMembership()；未登入 401
 * - client 只打自家 API；無 URL / tag 參數；browser 唔打 GitHub
 * - token 只伺服器環境變數
 * - Route Handler 只 call 共用 script
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';

import { requireUser } from '@/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const SCRIPT = join(ROOT, 'scripts', 'overlay-release.mjs');

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

async function loadMembership(): Promise<unknown | null | undefined> {
  try {
    const mod = await import('@/auth/session');
    const fn = (mod as { getCurrentMembership?: () => Promise<unknown> }).getCurrentMembership;
    if (typeof fn === 'function') {
      return await fn();
    }
  } catch {
    /* missing → requireUser only */
  }
  return null;
}

export async function GET() {
  return json(405, {
    error: 'Method Not Allowed',
    message: 'Use POST to check/apply updates',
  });
}

export async function POST(_req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return json(401, { error: 'Unauthorized', message: 'Login required' });
  }
  if (!user) {
    return json(401, { error: 'Unauthorized', message: 'Login required' });
  }

  try {
    const membership = await loadMembership();
    if (membership !== null && !membership) {
      return json(403, { error: 'Forbidden', message: 'No active membership' });
    }
  } catch {
    /* requireUser already passed */
  }

  const result = await runOverlayScript();

  if (result.exitCode === 10) {
    return json(200, {
      ok: true,
      updated: true,
      needRestart: true,
      message:
        'Update applied. Please restart the app (or re-run start.sh / start.bat).',
      tag: result.tag || null,
    });
  }

  if (result.exitCode === 0) {
    return json(200, {
      ok: true,
      updated: false,
      needRestart: false,
      message:
        result.stdout.includes('Already on latest') ||
        result.stdout.includes('latest official')
          ? 'Already on latest official release'
          : 'Check complete',
      log: result.stdout.slice(-2000),
    });
  }

  return json(500, {
    ok: false,
    error: 'Overlay failed',
    message:
      result.stderr.slice(-500) ||
      result.stdout.slice(-500) ||
      `exit ${result.exitCode}`,
    exitCode: result.exitCode,
  });
}

function runOverlayScript(): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  tag?: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, '--force', '--from-api'], {
      cwd: ROOT,
      env: {
        ...process.env,
        JL_FROM_API: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (e) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: (stderr + '\n' + (e.message || String(e))).trim(),
      });
    });

    child.on('close', async (code) => {
      let tag: string | undefined;
      if (code === 10) {
        try {
          const flag = await fs.readFile(join(ROOT, '.jl-need-restart'), 'utf8');
          tag = flag.trim().split('\n')[0] || undefined;
          await fs.unlink(join(ROOT, '.jl-need-restart')).catch(() => {});
        } catch {
          /* ignore */
        }
      }
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        tag,
      });
    });
  });
}
