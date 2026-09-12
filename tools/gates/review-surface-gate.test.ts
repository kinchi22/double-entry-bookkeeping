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
 * This asserts the two are the same set, and that the directory the isolation
 * check protects is one of them. The two readers are pure functions over file
 * content, so this file never becomes a third copy of the list: the sample
 * inputs below prove the readers work without naming a single owned path.
 */

const SECTION = '## Human review surface';

/** `/e2e/` and `e2e/**` both normalise to `e2e`. */
const normalise = (entry: string): string => entry.replace(/^\//, '').replace(/\/(\*\*)?$/, '');

/** A CODEOWNERS rule line: a path starting at the root, then its owners. */
const OWNED = /^(\/\S+)(?:[^\S\n]+@\S+)+[^\S\n]*$/gm;

const ownedPaths = (codeowners: string): readonly string[] =>
  [...codeowners.matchAll(OWNED)].flatMap((match) =>
    match[1] === undefined ? [] : [normalise(match[1])],
  );

/** The first column of every row in the table under the review-surface heading. */
const ROW = /^\|\s*`([^`]+)`\s*\|/gm;

const documentedPaths = (architecture: string): readonly string[] => {
  const start = architecture.indexOf(`\n${SECTION}\n`);
  if (start === -1) return [];

  const from = start + 1;
  const next = architecture.indexOf('\n## ', from);
  const section = next === -1 ? architecture.slice(from) : architecture.slice(from, next);
  return [...section.matchAll(ROW)].flatMap((match) =>
    match[1] === undefined ? [] : [normalise(match[1])],
  );
};

const read = (file: string): string => readFileSync(path.join(REPO_ROOT, file), 'utf8');

const sorted = (paths: readonly string[]): readonly string[] => [...paths].sort();

describe('the human review surface', () => {
  const documented = documentedPaths(read('docs/ARCHITECTURE.md'));
  const owned = ownedPaths(read('.github/CODEOWNERS'));

  it('is the same set of paths in ARCHITECTURE.md and in CODEOWNERS', () => {
    expect(sorted(documented)).toEqual(sorted(owned));
  });

  it('is not empty, which is how this check could agree by reading nothing', () => {
    expect(owned.length).toBeGreaterThan(0);
    expect(documented.length).toBeGreaterThan(0);
  });

  it('owns the directory the isolation check protects', () => {
    expect(owned).toContain(normalise(SPEC_ROOT));
  });
});

describe('the readers', () => {
  it('takes the path column of a CODEOWNERS rule, not the comments or the owners', () => {
    const sample = ['# The human review surface.', '#   /not-a-rule/  a comment', '', '/first/      @someone', '/second/deeper/   @someone @another', ''].join('\n');
    expect(ownedPaths(sample)).toEqual(['first', 'second/deeper']);
  });

  it('ignores a CODEOWNERS line with no owner, which owns nothing', () => {
    expect(ownedPaths('/unowned/\n')).toEqual([]);
  });

  it('takes the path column of the review-surface table, not the heading row', () => {
    const sample = [
      '## Something else',
      '',
      '| `elsewhere/**` | not this table |',
      '',
      SECTION,
      '',
      '| Path | Why |',
      '| ---- | --- |',
      '| `first/**` | because |',
      '| `second/deeper/**` | because |',
      '',
      '## After',
      '',
      '| `later/**` | not this table either |',
      '',
    ].join('\n');
    expect(documentedPaths(sample)).toEqual(['first', 'second/deeper']);
  });

  it('reads nothing when the section has been renamed away', () => {
    expect(documentedPaths(`## Human review budget\n\n| \`first/**\` | because |\n`)).toEqual([]);
  });

  it('normalises the two notations to the same path', () => {
    expect(normalise('/packages/db/drizzle/')).toBe(normalise('packages/db/drizzle/**'));
  });
});
