import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type Prerequisite = {
  readonly name: string;
  readonly outcome: 'success' | 'failure' | 'cancelled' | 'skipped';
};

export type Migration = {
  readonly state: 'none' | 'pending' | 'unknown';
  readonly reason?: 'missing-applied-commit' | 'uncomparable-applied-commit';
  readonly outcome:
    | 'not-started'
    | 'running'
    | 'success'
    | 'failure'
    | 'cancelled'
    | 'skipped'
    | 'skipped-no-migration';
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
  const failedPrerequisite = input.prerequisites.find(
    (prerequisite) => prerequisite.outcome !== 'success',
  );
  if (failedPrerequisite !== undefined) {
    return {
      decision: 'fail',
      reason: `${failedPrerequisite.name} was ${failedPrerequisite.outcome}; Production is not ready.`,
    };
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
        typeof item['name'] === 'string' &&
        isOneOf(item['outcome'], ['success', 'failure', 'cancelled', 'skipped']),
    ) &&
    isOneOf(migration['state'], ['none', 'pending', 'unknown']) &&
    isOneOf(migration['outcome'], [
      'not-started',
      'running',
      'success',
      'failure',
      'cancelled',
      'skipped',
      'skipped-no-migration',
    ]) &&
    (migration['reason'] === undefined ||
      isOneOf(migration['reason'], [
        'missing-applied-commit',
        'uncomparable-applied-commit',
      ]))
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

function publish(result: ReleaseDecision | ReleaseQueueDecision): void {
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
  } else {
    throw new Error('Expected `decide` or `queue` and an input matching that command.');
  }
}
