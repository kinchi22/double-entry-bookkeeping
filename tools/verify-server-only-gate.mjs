import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURE = path.join(REPO_ROOT, 'fixtures', 'server-only', 'client-imports-server.tsx');
const PROBE_DIR = path.join(REPO_ROOT, 'apps', 'web', 'app', '(app)', 'server-only-probe');
const PROBE_FILE = path.join(PROBE_DIR, 'page.tsx');
const PROBE_DIST = '.next-server-only-probe';

const fail = (message) => {
  console.error(`server-only gate is NOT alive: ${message}`);
  process.exit(1);
};

try {
  mkdirSync(PROBE_DIR, { recursive: true });
  cpSync(FIXTURE, PROBE_FILE);

  const result = spawnSync('pnpm', ['--filter', '@repo/web', 'exec', 'next', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_DIST_DIR: PROBE_DIST },
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.status === 0) {
    fail('next build succeeded with a client component importing @repo/core/server');
  }
  if (!/server-only|Server Component|server only/i.test(output)) {
    fail(
      `next build failed, but not because of the server-only marker. Output:\n${output.slice(-4000)}`,
    );
  }

  console.log('server-only gate is alive: next build rejected the client import.');
} finally {
  rmSync(PROBE_DIR, { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, 'apps', 'web', PROBE_DIST), { recursive: true, force: true });
}
