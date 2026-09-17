import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

/**
 * Whether `Apply migrations` has anything to apply: pure functions, plus a CLI
 * entry point. ADR-0019.
 *
 * Every push to `main` used to wait for the owner's approval, migration or not.
 * Now the job runs only when a file under `packages/db/drizzle/` changed since
 * the last commit Production was migrated at. That commit is read from the
 * `production-database` deployments GitHub records for each run of the job:
 * the newest one whose latest status is `success`.
 *
 * Measuring from the last applied commit rather than from this push is the
 * point. A run waiting for approval is cancelled by the next push to `main`,
 * and an approval can be rejected; either way the migration is still pending,
 * and the next push asks again.
 *
 * Every doubt resolves to "pending": no successful deployment, an API call
 * that failed, a commit git cannot compare. The cost of a wrong "pending" is an
 * approval request, which is what every push cost before; the cost of a wrong
 * "nothing pending" is a production schema behind its code.
 */

export const MIGRATIONS_ROOT = 'packages/db/drizzle/';

export const ENVIRONMENT = 'production-database';

export type Deployment = {
  readonly sha: string;
  /** The deployment's newest status, e.g. `success`, `error`, `waiting`. */
  readonly state: string;
};

export type Verdict = {
  readonly pending: boolean;
  readonly reason: string;
};

/**
 * The commit of the newest successful deployment. Deployments arrive newest
 * first, and the search stops at the first success, so a caller that fetches
 * each status lazily fetches no more than it needs.
 */
export function lastAppliedSha(deployments: Iterable<Deployment>): string | undefined {
  for (const deployment of deployments) {
    if (deployment.state === 'success') {
      return deployment.sha;
    }
  }
  return undefined;
}

/**
 * `changed` is every path that differs between the applied commit and this
 * one, or undefined when git could not compare them.
 */
export function decide(
  appliedSha: string | undefined,
  changed: readonly string[] | undefined,
): Verdict {
  if (appliedSha === undefined) {
    return {
      pending: true,
      reason: `No successful ${ENVIRONMENT} deployment was found, so a migration may be pending.`,
    };
  }
  if (changed === undefined) {
    return {
      pending: true,
      reason: `${appliedSha} could not be compared with this commit, so a migration may be pending.`,
    };
  }

  const migrations = changed.filter((file) => file.startsWith(MIGRATIONS_ROOT));
  if (migrations.length === 0) {
    return {
      pending: false,
      reason: `Nothing under ${MIGRATIONS_ROOT} changed since ${appliedSha}, the last commit Production was migrated at.`,
    };
  }
  return {
    pending: true,
    reason: [
      `${String(migrations.length)} file(s) under ${MIGRATIONS_ROOT} changed since ${appliedSha}:`,
      ...migrations.map((file) => `  ${file}`),
    ].join('\n'),
  };
}

/** A command's trimmed output, or undefined when it failed. */
function run(command: string, args: readonly string[]): string | undefined {
  const result = spawnSync(command, [...args], { encoding: 'utf8', shell: false });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

const lines = (text: string): readonly string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

/** Deployments newest first, each status fetched only when it is reached. */
function* deploymentsOf(repository: string): Generator<Deployment> {
  const listed = run('gh', [
    'api',
    `repos/${repository}/deployments?environment=${ENVIRONMENT}&per_page=100`,
    '--jq',
    '.[] | "\\(.id) \\(.sha)"',
  ]);
  if (listed === undefined) {
    console.log(`::warning::The ${ENVIRONMENT} deployments could not be listed.`);
    return;
  }

  for (const line of lines(listed)) {
    const [id = '', sha = ''] = line.split(' ');
    const state = run('gh', [
      'api',
      `repos/${repository}/deployments/${id}/statuses?per_page=1`,
      '--jq',
      '.[0].state // ""',
    ]);
    yield { sha, state: state ?? '' };
  }
}

if (import.meta.main) {
  // The repository comes from the environment Actions sets, and `gh` reads
  // GH_TOKEN from it. Run locally, both come from the developer's shell.
  const repository = process.env['GITHUB_REPOSITORY'] ?? '';
  const appliedSha = lastAppliedSha(deploymentsOf(repository));
  const diff =
    appliedSha === undefined ? undefined : run('git', ['diff', '--name-only', appliedSha, 'HEAD']);
  const verdict = decide(appliedSha, diff === undefined ? undefined : lines(diff));

  console.log(verdict.reason);
  const output = process.env['GITHUB_OUTPUT'];
  if (output !== undefined && output !== '') {
    appendFileSync(output, `pending=${String(verdict.pending)}\n`);
  }
}
