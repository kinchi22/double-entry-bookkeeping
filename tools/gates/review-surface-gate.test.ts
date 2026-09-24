import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPEC_ROOT } from '../check-pr-isolation';
import { REPO_ROOT } from './run-gate';

const SECTION = '## Human review surface';

const normalise = (entry: string): string => entry.replace(/^\//, '').replace(/\/(\*\*)?$/, '');

const OWNED = /^(\/\S+)(?:[^\S\n]+@\S+)+[^\S\n]*$/gm;

const ownedPaths = (codeowners: string): readonly string[] =>
  [...codeowners.matchAll(OWNED)].flatMap((match) =>
    match[1] === undefined ? [] : [normalise(match[1])],
  );

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
