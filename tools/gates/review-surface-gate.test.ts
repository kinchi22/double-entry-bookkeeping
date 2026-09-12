import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPEC_ROOT } from '../check-pr-isolation';
import { REPO_ROOT } from './run-gate';

/**
 * The human review surface is stated in two places, and ADR-0002 exists because
 * they disagreed: `docs/ARCHITECTURE.md` listed five subjects, `.github/CODEOWNERS`
 * listed three paths, and `e2e/` was on one of them. Only CODEOWNERS is executable,
 * so the prose was free to rot, and it did.
 *
 * This asserts the two lists are the same set, and that the directory the
 * isolation check protects is one of the owned paths. Without it, the fix is a
 * pair of documents that happen to agree today.
 */

/** `/e2e/` and `e2e/**` both normalise to `e2e`. */
const normalise = (entry: string): string => entry.replace(/^\//, '').replace(/\/(\*\*)?$/, '');

const read = (file: string): string => readFileSync(path.join(REPO_ROOT, file), 'utf8');

/** Owned paths, ignoring comments and the owner column. */
const OWNED = /^(\/\S+)\s+@\S+\s*$/gm;

const codeownerPaths = (): readonly string[] =>
  [...read('.github/CODEOWNERS').matchAll(OWNED)].flatMap((match) =>
    match[1] === undefined ? [] : [normalise(match[1])],
  );

/** First column of the table under `## Human review budget`, which is a path. */
const BUDGET_ROW = /^\|\s*`([^`]+)`\s*\|/gm;

const documentedPaths = (): readonly string[] => {
  const architecture = read('docs/ARCHITECTURE.md');
  const start = architecture.indexOf('\n## Human review budget\n');
  expect(start, 'docs/ARCHITECTURE.md has lost its "Human review budget" section').not.toBe(-1);

  const from = start + 1;
  const next = architecture.indexOf('\n## ', from);
  const section = next === -1 ? architecture.slice(from) : architecture.slice(from, next);
  return [...section.matchAll(BUDGET_ROW)].flatMap((match) =>
    match[1] === undefined ? [] : [normalise(match[1])],
  );
};

describe('the human review surface', () => {
  it('is the same set of paths in ARCHITECTURE.md and in CODEOWNERS', () => {
    expect([...documentedPaths()].sort()).toEqual([...codeownerPaths()].sort());
  });

  it('is not empty, which is the way this check could pass by reading nothing', () => {
    expect(codeownerPaths().length).toBeGreaterThan(0);
  });

  it('owns the directory the isolation check protects', () => {
    expect(codeownerPaths()).toContain(normalise(SPEC_ROOT));
  });
});

describe('the surface gate', () => {
  it('reads paths out of a CODEOWNERS file, not comments or owners', () => {
    expect(codeownerPaths()).toEqual(['e2e', 'packages/db/drizzle', '.github']);
  });

  it('normalises the two notations to the same path', () => {
    expect(normalise('/packages/db/drizzle/')).toBe(normalise('packages/db/drizzle/**'));
  });
});
