import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_PREREQUISITES = ['Gates', 'Integration'] as const;
export type RequiredPrerequisite = (typeof REQUIRED_PREREQUISITES)[number];

export const PREREQUISITE_OUTCOMES = ['success', 'failure', 'cancelled', 'skipped'] as const;
export type PrerequisiteOutcome = (typeof PREREQUISITE_OUTCOMES)[number];

export const MIGRATION_STATES = ['none', 'pending', 'unknown'] as const;
export type MigrationState = (typeof MIGRATION_STATES)[number];

export const MIGRATION_REASONS = [
  'missing-applied-commit',
  'uncomparable-applied-commit',
] as const;
export type MigrationReason = (typeof MIGRATION_REASONS)[number];

export const MIGRATION_OUTCOMES = [
  'not-started',
  'running',
  'success',
  'failure',
  'cancelled',
  'skipped',
  'skipped-no-migration',
] as const;
export type MigrationOutcome = (typeof MIGRATION_OUTCOMES)[number];

export type Prerequisite = {
  readonly name: RequiredPrerequisite;
  readonly outcome: PrerequisiteOutcome;
};

export type Migration = {
  readonly state: MigrationState;
  readonly reason?: MigrationReason;
  readonly outcome: MigrationOutcome;
};

export type ReleaseInput = {
  readonly prerequisites: readonly Prerequisite[];
  readonly migration: Migration;
};

export type ReleaseDecision = {
  readonly decision:
    | 'fail'
    | 'wait'
    | 'request-approval'
    | 'record-migration-success'
    | 'production-ready';
  readonly reason: string;
};

export type ReleaseQueueInput = {
  readonly runningCommit: string | null;
  /** Ordered from oldest to newest. */
  readonly waitingCommits: readonly string[];
};

export type ReleaseQueueDecision = {
  readonly runningCommit: string | null;
  readonly cancelRunning: false;
  readonly waitingCommit: string | null;
  readonly waitingDecision: 'recalculate-now' | 'recalculate-after-running' | null;
};

export function selectReleaseCommit(commit: string, mainHead: string | undefined): { current: boolean } {
  return { current: mainHead !== undefined && commit === mainHead };
}

export function coalesceProductionReleases(input: ReleaseQueueInput): ReleaseQueueDecision {
  const waitingCommit = input.waitingCommits.at(-1) ?? null;
  return {
    runningCommit: input.runningCommit,
    cancelRunning: false,
    waitingCommit,
    waitingDecision:
      waitingCommit === null
        ? null
        : input.runningCommit === null
          ? 'recalculate-now'
          : 'recalculate-after-running',
  };
}

export function decideProductionRelease(input: ReleaseInput): ReleaseDecision {
  for (const name of REQUIRED_PREREQUISITES) {
    const prerequisites = input.prerequisites.filter((candidate) => candidate.name === name);
    const prerequisite = prerequisites[0];
    if (prerequisite === undefined) {
      return {
        decision: 'fail',
        reason: `${name} result is missing; Production is not ready.`,
      };
    }
    if (prerequisites.length !== 1) {
      return {
        decision: 'fail',
        reason: `${name} result is duplicated; Production is not ready.`,
      };
    }
    if (prerequisite.outcome !== 'success') {
      return {
        decision: 'fail',
        reason: `${prerequisite.name} was ${prerequisite.outcome}; Production is not ready.`,
      };
    }
  }

  if (input.migration.state === 'unknown') {
    return {
      decision: 'request-approval',
      reason: `Migration state is unknown (${input.migration.reason ?? 'unspecified'}); Production approval is required.`,
    };
  }

  if (input.migration.state === 'none') {
    if (input.migration.outcome === 'skipped-no-migration') {
      return {
        decision: 'production-ready',
        reason: 'No migration is pending; the intentional migration skip is valid.',
      };
    }
    if (input.migration.outcome === 'success') {
      return {
        decision: 'production-ready',
        reason: 'Migration success is already recorded and every prerequisite succeeded.',
      };
    }
    if (input.migration.outcome === 'skipped') {
      return {
        decision: 'fail',
        reason: 'The migration prerequisite was skipped without a no-migration decision.',
      };
    }
  }

  if (input.migration.state === 'pending') {
    if (input.migration.outcome === 'not-started') {
      return {
        decision: 'request-approval',
        reason: 'A Production migration is pending and requires approval.',
      };
    }
    if (input.migration.outcome === 'running') {
      return {
        decision: 'wait',
        reason: 'The Production migration is running and must not be cancelled.',
      };
    }
    if (input.migration.outcome === 'success') {
      return {
        decision: 'record-migration-success',
        reason:
          'The Production migration succeeded; record its commit before downstream checks.',
      };
    }
  }

  return {
    decision: 'fail',
    reason: `The Production migration was ${input.migration.outcome}; Production is not ready.`,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOneOf = <T extends string>(value: unknown, choices: readonly T[]): value is T =>
  typeof value === 'string' && choices.includes(value as T);

function parseInput(source: string | undefined): unknown {
  if (source === undefined || source.trim() === '') {
    throw new Error('Production release input must be a JSON argument.');
  }
  return JSON.parse(source) as unknown;
}

function isReleaseInput(value: unknown): value is ReleaseInput {
  if (!isRecord(value) || !Array.isArray(value['prerequisites']) || !isRecord(value['migration'])) {
    return false;
  }
  const prerequisites = value['prerequisites'];
  const migration = value['migration'];
  return (
    prerequisites.every(
      (item) =>
        isRecord(item) &&
        isOneOf(item['name'], REQUIRED_PREREQUISITES) &&
        isOneOf(item['outcome'], PREREQUISITE_OUTCOMES),
    ) &&
    isOneOf(migration['state'], MIGRATION_STATES) &&
    isOneOf(migration['outcome'], MIGRATION_OUTCOMES) &&
    (migration['reason'] === undefined || isOneOf(migration['reason'], MIGRATION_REASONS))
  );
}

function isQueueInput(value: unknown): value is ReleaseQueueInput {
  return (
    isRecord(value) &&
    (typeof value['runningCommit'] === 'string' || value['runningCommit'] === null) &&
    Array.isArray(value['waitingCommits']) &&
    value['waitingCommits'].every((commit) => typeof commit === 'string')
  );
}

function isCurrentInput(value: unknown): value is { commit: string; mainHead?: string } {
  return isRecord(value) && typeof value['commit'] === 'string' &&
    (value['mainHead'] === undefined || typeof value['mainHead'] === 'string');
}

function publish(result: ReleaseDecision | ReleaseQueueDecision | { current: boolean }): void {
  console.log(JSON.stringify(result));
  const output = process.env['GITHUB_OUTPUT'];
  if (output !== undefined && output !== '') {
    appendFileSync(
      output,
      Object.entries(result)
        .map(([name, value]) => `${name}=${String(value ?? '')}`)
        .join('\n') + '\n',
    );
  }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && pathToFileURL(path.resolve(entryPoint)).href === import.meta.url) {
  const command = process.argv[2];
  const input = parseInput(process.argv[3]);
  if (command === 'decide' && isReleaseInput(input)) {
    publish(decideProductionRelease(input));
  } else if (command === 'queue' && isQueueInput(input)) {
    publish(coalesceProductionReleases(input));
  } else if (command === 'current' && isCurrentInput(input)) {
    publish(selectReleaseCommit(input.commit, input.mainHead));
  } else {
    throw new Error('Expected `decide`, `queue` or `current` and an input matching that command.');
  }
}
