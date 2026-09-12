import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { type AdrFile, findAdrProblems } from './adr';
import { REPO_ROOT } from './run-gate';

/**
 * Section 9, applied to the decision record.
 *
 * ADR-0001 says a deferred decision is revisited by editing its own file. That
 * only works if the file is still findable and still says what it is, which is
 * a property nothing else in this repo would notice losing: docs do not fail to
 * compile. So the shape is asserted here, in both directions -- the records
 * against the index, and the index against the records.
 *
 * The second half of the file checks the checker. A validator that stopped
 * reporting would leave this suite green over a directory that had quietly
 * rotted, which is the failure mode `fixtures/` exists to prevent everywhere
 * else.
 */

const DOCS_DIR = path.join(REPO_ROOT, 'docs');
const ADR_DIR = path.join(DOCS_DIR, 'adr');

const readRecords = (): readonly AdrFile[] =>
  readdirSync(ADR_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'template.md')
    .map((name) => ({ name, content: readFileSync(path.join(ADR_DIR, name), 'utf8') }));

const readIndexLinks = (): readonly string[] => {
  const architecture = readFileSync(path.join(DOCS_DIR, 'ARCHITECTURE.md'), 'utf8');
  return [...architecture.matchAll(/\((adr\/[^)]+\.md)\)/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
};

describe('docs/adr', () => {
  it('holds records the index and the gate both accept', () => {
    expect(findAdrProblems(readRecords(), readIndexLinks())).toEqual([]);
  });

  it('is indexed from ARCHITECTURE.md, which is where CLAUDE.md sends a reader', () => {
    expect(readIndexLinks().length).toBeGreaterThan(0);
  });
});

const record = (number: string, body: string): AdrFile => ({
  name: `${number}-a-decision.md`,
  content: [
    `# ADR-${number}: A decision`,
    '',
    body,
    '',
    '## Problem',
    'Something forced a choice.',
    '',
    '## Decision',
    'This one.',
    '',
    '## Consequences',
    'These.',
    '',
    '## Rejected alternatives',
    'That one, because of this.',
    '',
  ].join('\n'),
});

const accepted = (number: string): AdrFile =>
  record(number, '**Status:** Accepted\n**Date:** 2026-09-12');

const indexOf = (...files: readonly AdrFile[]): readonly string[] =>
  files.map((file) => `adr/${file.name}`);

describe('the ADR gate', () => {
  it('passes a well-formed record', () => {
    const file = accepted('0001');
    expect(findAdrProblems([file], indexOf(file))).toEqual([]);
  });

  it('rejects a file name that is not NNNN-kebab-case', () => {
    const file: AdrFile = { name: 'decisions.md', content: accepted('0001').content };
    expect(findAdrProblems([file], ['adr/decisions.md'])).toContain(
      'decisions.md: name must be NNNN-kebab-case-title.md',
    );
  });

  it('rejects a heading whose number disagrees with the file name', () => {
    const file: AdrFile = { name: '0001-a-decision.md', content: accepted('0002').content };
    expect(findAdrProblems([file], indexOf(file))).toContain(
      '0001-a-decision.md: heading says ADR-0002, file name says ADR-0001',
    );
  });

  it('rejects a status outside the vocabulary', () => {
    const file = record('0001', '**Status:** Proposed\n**Date:** 2026-09-12');
    expect(findAdrProblems([file], indexOf(file))).toContain(
      '0001-a-decision.md: status \'Proposed\' is not Accepted, Deferred, or Superseded by ADR-NNNN',
    );
  });

  it('rejects a deferred record that does not say what would adopt it', () => {
    const file = record('0001', '**Status:** Deferred\n**Date:** 2026-09-12');
    expect(findAdrProblems([file], indexOf(file))).toContain(
      '0001-a-decision.md: a Deferred record needs a \'**Trigger:** ...\' line',
    );
  });

  it('accepts a deferred record that does', () => {
    const file = record(
      '0001',
      '**Status:** Deferred\n**Date:** 2026-09-12\n**Trigger:** the second locale ships.',
    );
    expect(findAdrProblems([file], indexOf(file))).toEqual([]);
  });

  it('rejects a supersede pointing at a record that does not exist', () => {
    const file = record('0001', '**Status:** Superseded by ADR-0009\n**Date:** 2026-09-12');
    expect(findAdrProblems([file], indexOf(file))).toContain(
      '0001-a-decision.md: superseded by ADR-0009, which does not exist',
    );
  });

  it('rejects a missing section', () => {
    const file = accepted('0001');
    const stripped: AdrFile = {
      name: file.name,
      content: file.content.replace('## Rejected alternatives', '## Notes'),
    };
    expect(findAdrProblems([stripped], indexOf(stripped))).toContain(
      '0001-a-decision.md: missing section \'## Rejected alternatives\'',
    );
  });

  it('rejects a hole in the numbering', () => {
    const first = accepted('0001');
    const third = accepted('0003');
    expect(findAdrProblems([first, third], indexOf(first, third))).toContain(
      'ADR numbering has a hole: expected ADR-0002, found ADR-0003',
    );
  });

  it('rejects a record the index does not link', () => {
    const file = accepted('0001');
    expect(findAdrProblems([file], [])).toContain('0001-a-decision.md: not linked from the index');
  });

  it('rejects an index link with no record behind it', () => {
    const file = accepted('0001');
    expect(findAdrProblems([file], [...indexOf(file), 'adr/0002-a-ghost.md'])).toContain(
      'the index links adr/0002-a-ghost.md, which does not exist',
    );
  });
});
