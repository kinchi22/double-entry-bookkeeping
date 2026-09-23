import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { coalesceProductionReleases, decideProductionRelease, selectReleaseCommit } from '../production-release';
import { REPO_ROOT } from './run-gate';

const SUCCESSFUL_PREREQUISITES = [
  { name: 'Gates', outcome: 'success' },
  { name: 'Integration', outcome: 'success' },
] as const;

describe('decideProductionRelease', () => {
  it.each([
    ['Gates', [{ name: 'Integration', outcome: 'success' }]],
    ['Integration', [{ name: 'Gates', outcome: 'success' }]],
  ] as const)('fails closed when the %s result is missing', (name, prerequisites) => {
    expect(
      decideProductionRelease({
        prerequisites,
        migration: { state: 'none', outcome: 'skipped-no-migration' },
      }),
    ).toEqual({
      decision: 'fail',
      reason: `${name} result is missing; Production is not ready.`,
    });
  });

  it('fails closed when a required prerequisite result is duplicated', () => {
    expect(
      decideProductionRelease({
        prerequisites: [
          { name: 'Gates', outcome: 'success' },
          { name: 'Gates', outcome: 'failure' },
          { name: 'Integration', outcome: 'success' },
        ],
        migration: { state: 'none', outcome: 'skipped-no-migration' },
      }),
    ).toEqual({
      decision: 'fail',
      reason: 'Gates result is duplicated; Production is not ready.',
    });
  });

  it.each(['missing-applied-commit', 'uncomparable-applied-commit'] as const)(
    'requests approval when migration state is unknown because it is %s',
    (reason) => {
      expect(
        decideProductionRelease({
          prerequisites: SUCCESSFUL_PREREQUISITES,
          migration: { state: 'unknown', reason, outcome: 'not-started' },
        }),
      ).toEqual({
        decision: 'request-approval',
        reason: `Migration state is unknown (${reason}); Production approval is required.`,
      });
    },
  );

  it.each(['failure', 'cancelled', 'skipped'] as const)(
    'fails when a prerequisite is %s',
    (outcome) => {
      expect(
        decideProductionRelease({
          prerequisites: [
            { name: 'Gates', outcome: 'success' },
            { name: 'Integration', outcome },
          ],
          migration: { state: 'none', outcome: 'skipped-no-migration' },
        }),
      ).toEqual({
        decision: 'fail',
        reason: `Integration was ${outcome}; Production is not ready.`,
      });
    },
  );

  it.each([
    [
      'production-ready',
      { state: 'none', outcome: 'skipped-no-migration' },
      'No migration is pending; the intentional migration skip is valid.',
    ],
    [
      'fail',
      { state: 'none', outcome: 'skipped' },
      'The migration prerequisite was skipped without a no-migration decision.',
    ],
    [
      'request-approval',
      { state: 'pending', outcome: 'not-started' },
      'A Production migration is pending and requires approval.',
    ],
    [
      'wait',
      { state: 'pending', outcome: 'running' },
      'The Production migration is running and must not be cancelled.',
    ],
    [
      'record-migration-success',
      { state: 'pending', outcome: 'success' },
      'The Production migration succeeded; record its commit before downstream checks.',
    ],
    [
      'production-ready',
      { state: 'none', outcome: 'success' },
      'Migration success is already recorded and every prerequisite succeeded.',
    ],
    [
      'fail',
      { state: 'pending', outcome: 'failure' },
      'The Production migration was failure; Production is not ready.',
    ],
    [
      'fail',
      { state: 'pending', outcome: 'cancelled' },
      'The Production migration was cancelled; Production is not ready.',
    ],
  ] as const)(
    'returns %s for a migration outcome',
    (decision, migration, reason) => {
      expect(
        decideProductionRelease({
          prerequisites: SUCCESSFUL_PREREQUISITES,
          migration,
        }),
      ).toEqual({ decision, reason });
    },
  );
});

describe('coalesceProductionReleases', () => {
  it('keeps a running migration and coalesces waiting releases to the newest commit', () => {
    expect(
      coalesceProductionReleases({
        runningCommit: 'running',
        waitingCommits: ['older', 'newest'],
      }),
    ).toEqual({
      runningCommit: 'running',
      cancelRunning: false,
      waitingCommit: 'newest',
      waitingDecision: 'recalculate-after-running',
    });
  });

  it('recalculates pending migrations for the newest commit when no migration is running', () => {
    expect(
      coalesceProductionReleases({
        runningCommit: null,
        waitingCommits: ['older', 'newest'],
      }),
    ).toEqual({
      runningCommit: null,
      cancelRunning: false,
      waitingCommit: 'newest',
      waitingDecision: 'recalculate-now',
    });
  });
});

describe('selectReleaseCommit', () => {
  it('releases only the newest main commit after a queued run starts', () => {
    expect(selectReleaseCommit('older', 'newest')).toEqual({ current: false });
    expect(selectReleaseCommit('newest', 'newest')).toEqual({ current: true });
  });

  it('fails closed when the main ref cannot be read', () => {
    expect(selectReleaseCommit('newest', undefined)).toEqual({ current: false });
  });
});

describe('Production release workflow invariants', () => {
  const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
  const release = readFileSync(
    path.join(REPO_ROOT, '.github/workflows/production-release.yml'),
    'utf8',
  );

  it('keeps a running migration and the newest waiting run without canceling validation', () => {
    expect(ci).not.toMatch(/^concurrency:/m);
    expect(ci).toMatch(/group: production-release\n\s+queue: max/);
    expect(ci).toMatch(/release:\n[\s\S]*?needs: \[gates, integration\]/);
    expect(release).toContain("needs.select.outputs.current == 'true'");
  });

  it('orders the database work and publishes readiness for every main push', () => {
    expect(release).toMatch(/preview:[\s\S]*?pending:[\s\S]*?needs: preview/);
    expect(release).toMatch(/migrate:[\s\S]*?needs: pending/);
    expect(release).toContain('exit 1');
    expect(ci).toMatch(/production-ready:\n\s+name: Production ready\n\s+if: always\(\)/);
    expect(ci).toContain('needs: [gates, integration, release]');
  });

  it('rechecks the main commit after pending detection before requesting approval', () => {
    const pending = release.slice(release.indexOf('\n  pending:'), release.indexOf('\n  migrate:'));
    const migrate = release.slice(release.indexOf('\n  migrate:'), release.indexOf('\n  result:'));

    expect(pending.indexOf('node tools/find-pending-migrations.ts')).toBeLessThan(
      pending.lastIndexOf('node tools/production-release.ts current'),
    );
    expect(migrate).toContain("needs.pending.outputs.current == 'true'");
    expect(release).toContain('CURRENT_AFTER_PENDING: ${{ needs.pending.outputs.current }}');
  });

  it('smokes Current Production after migration and requires it for readiness', () => {
    expect(release).toMatch(/compatibility:[\s\S]*?needs: result/);
    expect(release).toContain('E2E_BASE_URL: ${{ vars.PRODUCTION_URL }}');
    expect(release).toContain('pnpm test:e2e --grep @smoke');
    expect(ci).toContain('COMPATIBILITY_RESULT: ${{ needs.release.outputs.compatibility_result }}');
    expect(ci).toContain('test "$COMPATIBILITY_RESULT" = success');
  });

  it('checks the exact ready-event SHA and publishes candidate status', () => {
    const candidate = readFileSync(
      path.join(REPO_ROOT, '.github/workflows/candidate-production-smoke.yml'), 'utf8',
    );
    expect(candidate).toContain('vercel.deployment.ready');
    expect(candidate).toContain('permissions:');
    expect(candidate).toContain('actions: read');
    expect(candidate).toContain('statuses: write');
    expect(candidate).toContain('ref: ${{ steps.pending.outputs.sha }}');
    expect(candidate).toContain('E2E_BASE_URL: ${{ steps.pending.outputs.url }}');
    expect(candidate).toContain('pnpm test:e2e --grep @smoke');
  });
});

describe('production-release.ts, run as CI runs it', () => {
  const runCommand = (command: string, input: unknown) =>
    spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'tools', 'production-release.ts'), command, JSON.stringify(input)],
      { encoding: 'utf8' },
    );

  it('exposes release decisions as JSON', () => {
    const result = runCommand('decide', {
      prerequisites: SUCCESSFUL_PREREQUISITES,
      migration: { state: 'none', outcome: 'skipped-no-migration' },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      decision: 'production-ready',
      reason: 'No migration is pending; the intentional migration skip is valid.',
    });
  });

  it('exposes queue decisions as JSON', () => {
    const result = runCommand('queue', {
      runningCommit: 'running',
      waitingCommits: ['old', 'new'],
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      runningCommit: 'running',
      cancelRunning: false,
      waitingCommit: 'new',
      waitingDecision: 'recalculate-after-running',
    });
  });

  it('exposes the current-main decision for a queued release', () => {
    const result = runCommand('current', { commit: 'older', mainHead: 'newest' });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ current: false });
  });

  it('writes scalar release outputs for a workflow step', () => {
    const sandbox = mkdtempSync(path.join(tmpdir(), 'production-release-'));
    const output = path.join(sandbox, 'output');
    try {
      const result = spawnSync(
        process.execPath,
        [
          path.join(REPO_ROOT, 'tools', 'production-release.ts'),
          'decide',
          JSON.stringify({
            prerequisites: SUCCESSFUL_PREREQUISITES,
            migration: { state: 'pending', outcome: 'running' },
          }),
        ],
        { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output } },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(output, 'utf8')).toBe(
        [
          'decision=wait',
          'reason=The Production migration is running and must not be cancelled.',
          '',
        ].join('\n'),
      );
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('fails closed when a required prerequisite result is absent', () => {
    const result = runCommand('decide', {
      prerequisites: [{ name: 'Gates', outcome: 'success' }],
      migration: { state: 'none', outcome: 'skipped-no-migration' },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      decision: 'fail',
      reason: 'Integration result is missing; Production is not ready.',
    });
  });

  it('fails closed when the command or input is missing', () => {
    const result = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'tools', 'production-release.ts'), 'decide'],
      { encoding: 'utf8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Production release input must be a JSON argument.');
  });
});
