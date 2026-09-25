import { spawnSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const CONFIG = 'fixtures/mutation/stryker.fixture.config.json';

const result = spawnSync('pnpm', ['exec', 'stryker', 'run', CONFIG], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  shell: false,
  maxBuffer: 32 * 1024 * 1024,
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

if (result.status === 0) {
  console.error(
    'mutation gate is NOT alive: Stryker accepted a test that only asserts on a mock.',
  );
  console.error(output.slice(-4000));
  process.exit(1);
}

if (!/break threshold|under the break threshold|mutation score/i.test(output)) {
  console.error('mutation gate is NOT alive: Stryker failed for an unrelated reason.');
  console.error(output.slice(-4000));
  process.exit(1);
}

console.log('mutation gate is alive: Stryker rejected the mock-only test.');
