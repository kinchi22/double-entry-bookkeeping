/**
 * The shape rules for `docs/adr/`, as a pure function.
 *
 * Pure because the interesting cases are the broken ones. Every other gate here
 * proves it still fires by running real tooling over a fixture that is wrong on
 * purpose; a validator that takes its inputs as values can be handed the same
 * deliberate breakages directly, so the fixtures live in the test beside the
 * assertion instead of in a directory the reader has to go and find.
 */

export type AdrFile = {
  /** Base name, e.g. `0001-record-architecture-decisions.md`. */
  readonly name: string;
  readonly content: string;
};

const FILE_NAME = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const HEADING = /^# ADR-(\d{4}): \S/m;
const STATUS_LINE = /^\*\*Status:\*\* (.+)$/m;
const DATE_LINE = /^\*\*Date:\*\* \d{4}-\d{2}-\d{2}$/m;
const SUPERSEDED_BY = /^Superseded by ADR-(\d{4})$/;

const REQUIRED_SECTIONS = [
  '## Problem',
  '## Decision',
  '## Consequences',
  '## Rejected alternatives',
] as const;

/**
 * A deferred record is the one that rots. It describes something nobody is
 * building, so nothing fails when it drifts out of date, and the reason it was
 * deferred is the first thing to go. Requiring the trigger keeps the condition
 * for revisiting it in the file rather than in whoever remembers the discussion.
 */
const TRIGGER_LINE = /^\*\*Trigger:\*\* \S/m;

const numberOf = (name: string): number | undefined => {
  const match = FILE_NAME.exec(name);
  return match?.[1] === undefined ? undefined : Number(match[1]);
};

const pad = (value: number): string => String(value).padStart(4, '0');

/**
 * Every way `docs/adr/` can be wrong, as human-readable lines.
 *
 * `indexedPaths` are the ADR links found in `docs/ARCHITECTURE.md`, relative to
 * `docs/`. The check runs in both directions: a record missing from the index is
 * invisible to a reader who starts where `CLAUDE.md` points them, and an index
 * row pointing at a file that no longer exists is a decision that looks recorded
 * and is not.
 */
export function findAdrProblems(
  files: readonly AdrFile[],
  indexedPaths: readonly string[],
): readonly string[] {
  const problems: string[] = [];

  const named = files.filter((file) => {
    if (FILE_NAME.test(file.name)) return true;
    problems.push(`${file.name}: name must be NNNN-kebab-case-title.md`);
    return false;
  });

  const numbers = new Set<number>();
  for (const file of named) {
    const number = numberOf(file.name);
    if (number === undefined) continue;
    if (numbers.has(number)) problems.push(`${file.name}: ADR-${pad(number)} is used twice`);
    numbers.add(number);
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  sorted.forEach((number, index) => {
    if (number !== index + 1) {
      problems.push(`ADR numbering has a hole: expected ADR-${pad(index + 1)}, found ADR-${pad(number)}`);
    }
  });

  for (const file of named) {
    const number = numberOf(file.name);
    if (number === undefined) continue;

    const heading = HEADING.exec(file.content);
    if (heading === null) {
      problems.push(`${file.name}: needs a '# ADR-NNNN: Title' heading`);
    } else if (heading[1] !== pad(number)) {
      problems.push(`${file.name}: heading says ADR-${heading[1] ?? ''}, file name says ADR-${pad(number)}`);
    }

    if (!DATE_LINE.test(file.content)) {
      problems.push(`${file.name}: needs a '**Date:** YYYY-MM-DD' line`);
    }

    for (const section of REQUIRED_SECTIONS) {
      if (!file.content.includes(`\n${section}\n`)) {
        problems.push(`${file.name}: missing section '${section}'`);
      }
    }

    const status = STATUS_LINE.exec(file.content)?.[1];
    if (status === undefined) {
      problems.push(`${file.name}: needs a '**Status:** ...' line`);
      continue;
    }

    const superseded = SUPERSEDED_BY.exec(status);
    if (status === 'Deferred') {
      if (!TRIGGER_LINE.test(file.content)) {
        problems.push(`${file.name}: a Deferred record needs a '**Trigger:** ...' line`);
      }
    } else if (superseded !== null) {
      const target = Number(superseded[1]);
      if (!numbers.has(target)) {
        problems.push(`${file.name}: superseded by ADR-${pad(target)}, which does not exist`);
      }
    } else if (status !== 'Accepted') {
      problems.push(
        `${file.name}: status '${status}' is not Accepted, Deferred, or Superseded by ADR-NNNN`,
      );
    }
  }

  const indexed = new Set(indexedPaths.map((entry) => entry.replace(/^adr\//, '')));
  for (const file of named) {
    if (!indexed.has(file.name)) problems.push(`${file.name}: not linked from the index`);
  }
  const present = new Set(named.map((file) => file.name));
  for (const entry of indexed) {
    if (!present.has(entry)) problems.push(`the index links adr/${entry}, which does not exist`);
  }

  return problems;
}
