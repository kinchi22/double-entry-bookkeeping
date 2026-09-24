import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export const MIGRATIONS_ROOT = 'packages/db/drizzle/';

export const ENVIRONMENT = 'production-database';

export type Deployment = {
  readonly sha: string;
  readonly state: string;
};

export type Verdict = {
  readonly pending: boolean;
  readonly reason: string;
};

export function lastAppliedSha(deployments: Iterable<Deployment>): string | undefined {
  for (const deployment of deployments) {
    if (deployment.state === 'success') {
      return deployment.sha;
    }
  }
  return undefined;
}

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

function run(command: string, args: readonly string[]): string | undefined {
  const result = spawnSync(command, [...args], { encoding: 'utf8', shell: false });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

const lines = (text: string): readonly string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

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
