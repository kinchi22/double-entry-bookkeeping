import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { type AdrFile, findAdrProblems, findTemplateProblems, type IndexRow } from './adr-shape';
import { REPO_ROOT } from './run-gate';

/**
 * Section 9, applied to the decision record.
 *
 * A deferred decision is revisited by editing its own file, and
 * `docs/ARCHITECTURE.md` indexes what exists. Neither property fails to
 * compile when it stops holding, so both are asserted here, in both directions:
 * the ADRs against the index, and the index against the ADRs.
 *
 * The second half checks the checker. A validator that quietly stopped
 * reporting would leave this suite green over a directory that had rotted,
 * which is the failure `fixtures/` exists to prevent everywhere else.
 */

const DOCS_DIR = path.join(REPO_ROOT, 'docs');
const ADR_DIR = path.join(DOCS_DIR, 'adr');

const readAdrs = (): readonly AdrFile[] =>
  readdirSync(ADR_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'template.md')
    .map((name) => ({ name, content: readFileSync(path.join(ADR_DIR, name), 'utf8') }));

/**
 * Rows of the index table, not every link in the file. A passing mention of an
 * ADR in prose is not an index entry, and the template is linked from prose.
 */
const INDEX_ROW = /^\|\s*\[[^\]]+\]\((adr\/[^)]+\.md)\)\s*\|\s*([^|]+?)\s*\|\s*$/gm;

const readIndex = (): readonly IndexRow[] => {
  const architecture = readFileSync(path.join(DOCS_DIR, 'ARCHITECTURE.md'), 'utf8');
  return [...architecture.matchAll(INDEX_ROW)].flatMap((match) =>
    match[1] === undefined || match[2] === undefined
      ? []
      : [{ file: match[1], status: match[2] }],
  );
};

describe('docs/adr', () => {
  it('holds ADRs the index and the gate both accept', () => {
    expect(findAdrProblems(readAdrs(), readIndex())).toEqual([]);
  });

  it('is indexed from ARCHITECTURE.md, which is where AGENTS.md sends a reader', () => {
    expect(readIndex().length).toBeGreaterThan(0);
  });

  it('keeps a template that still describes the shape', () => {
    const template = readFileSync(path.join(ADR_DIR, 'template.md'), 'utf8');
    expect(findTemplateProblems(template)).toEqual([]);
  });
});

const adr = (number: string, header: string): AdrFile => ({
  name: `${number}-a-decision.md`,
  content: [
    `# ADR-${number}: A decision`,
    '',
    header,
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
  adr(number, '**Status:** Accepted\n**Date:** 2026-09-12');

const listing = (...files: readonly AdrFile[]): readonly IndexRow[] =>
  files.map((file) => ({ file: `adr/${file.name}`, status: 'Accepted' }));

/** One ADR, correctly indexed, so each case below produces exactly one problem. */
const check = (file: AdrFile, status = 'Accepted'): readonly string[] =>
  findAdrProblems([file], [{ file: `adr/${file.name}`, status }]);

describe('the ADR gate', () => {
  it('passes a well-formed ADR', () => {
    expect(check(accepted('0001'))).toEqual([]);
  });

  it('rejects a file name that is not NNNN-kebab-case', () => {
    const file: AdrFile = { name: 'decisions.md', content: accepted('0001').content };
    expect(findAdrProblems([file], [])).toEqual([
      'decisions.md: name must be NNNN-kebab-case-title.md',
    ]);
  });

  it('rejects a heading whose number disagrees with the file name', () => {
    const file: AdrFile = { name: '0041-a-decision.md', content: accepted('0042').content };
    expect(check(file)).toEqual([
      '0041-a-decision.md: heading says ADR-0042, file name says ADR-0041',
    ]);
  });

  it('rejects a status outside the vocabulary', () => {
    expect(check(adr('0001', '**Status:** Proposed\n**Date:** 2026-09-12'), 'Proposed')).toEqual([
      "0001-a-decision.md: status 'Proposed' is not one of Accepted, Deferred, Superseded by ADR-NNNN",
    ]);
  });

  it('rejects a missing date', () => {
    expect(check(adr('0001', '**Status:** Accepted'))).toEqual([
      "0001-a-decision.md: needs a '**Date:** YYYY-MM-DD' line",
    ]);
  });

  it('rejects a missing section', () => {
    const file = accepted('0001');
    const stripped: AdrFile = {
      name: file.name,
      content: file.content.replace('## Rejected alternatives', '## Notes'),
    };
    expect(check(stripped)).toEqual([
      "0001-a-decision.md: missing section '## Rejected alternatives'",
    ]);
  });

  it('rejects a section that is only a heading', () => {
    const file = accepted('0001');
    const emptied: AdrFile = {
      name: file.name,
      content: file.content.replace('That one, because of this.', ''),
    };
    expect(check(emptied)).toEqual(["0001-a-decision.md: section '## Rejected alternatives' is empty"]);
  });

  it('rejects a duplicate number', () => {
    const first = accepted('0041');
    const twin: AdrFile = { name: '0041-another-decision.md', content: first.content };
    expect(findAdrProblems([first, twin], listing(first, twin))).toEqual([
      '0041-another-decision.md: ADR-0041 is used twice',
    ]);
  });

  it('accepts a hole left by a deleted record without reusing its number', () => {
    const first = accepted('0001');
    const third = accepted('0003');
    expect(findAdrProblems([first, third], listing(first, third))).toEqual([]);
  });

  it('rejects a supersede pointing at an ADR that does not exist', () => {
    const file = adr('0001', '**Status:** Superseded by ADR-0009\n**Date:** 2026-09-12');
    expect(check(file, 'Superseded by ADR-0009')).toEqual([
      '0001-a-decision.md: superseded by ADR-0009, which does not exist',
    ]);
  });

  it('accepts a supersede pointing at one that does', () => {
    const first = adr('0001', '**Status:** Superseded by ADR-0002\n**Date:** 2026-09-12');
    const second = accepted('0002');
    expect(
      findAdrProblems(
        [first, second],
        [
          { file: `adr/${first.name}`, status: 'Superseded by ADR-0002' },
          { file: `adr/${second.name}`, status: 'Accepted' },
        ],
      ),
    ).toEqual([]);
  });
});

describe('the deferred-to-adopted path', () => {
  const deferred = (extra = ''): AdrFile =>
    adr('0001', `**Status:** Deferred\n**Date:** 2026-09-12\n**Trigger:** the second locale ships.${extra}`);

  it('accepts a deferred ADR that says what would adopt it', () => {
    expect(check(deferred(), 'Deferred')).toEqual([]);
  });

  it('rejects a deferred ADR that does not', () => {
    const file = adr('0001', '**Status:** Deferred\n**Date:** 2026-09-12');
    expect(check(file, 'Deferred')).toEqual([
      "0001-a-decision.md: a Deferred ADR needs a '**Trigger:** ...' line",
    ]);
  });

  it('rejects a status that never followed the adoption', () => {
    expect(check(deferred('\n**Adopted:** 2026-10-01, PR #12'), 'Deferred')).toEqual([
      '0001-a-decision.md: adopted, but still marked Deferred',
    ]);
  });

  it('rejects an adoption with no date and PR, which is the field the workflow turns on', () => {
    const file = adr(
      '0001',
      '**Status:** Accepted\n**Date:** 2026-09-12\n**Trigger:** the second locale ships.',
    );
    expect(check(file)).toEqual([
      "0001-a-decision.md: was deferred, so it needs an '**Adopted:** ...' line",
    ]);
  });

  it('rejects an adoption line that does not name a date and a PR', () => {
    const file = adr(
      '0001',
      '**Status:** Accepted\n**Date:** 2026-09-12\n**Trigger:** x.\n**Adopted:** last Tuesday',
    );
    expect(check(file)).toEqual([
      "0001-a-decision.md: '**Adopted:** last Tuesday' is not 'YYYY-MM-DD, PR #N'",
    ]);
  });

  it('accepts an ADR that waited and then landed', () => {
    const file = adr(
      '0001',
      '**Status:** Accepted\n**Date:** 2026-09-12\n**Trigger:** the second locale ships.\n**Adopted:** 2026-10-01, PR #12',
    );
    expect(check(file)).toEqual([]);
  });
  it('accepts a deferred ADR that was replaced rather than adopted', () => {
    const first = adr(
      '0001',
      '**Status:** Superseded by ADR-0002\n**Date:** 2026-09-12\n**Trigger:** the second locale ships.',
    );
    const second = accepted('0002');
    expect(
      findAdrProblems(
        [first, second],
        [
          { file: `adr/${first.name}`, status: 'Superseded by ADR-0002' },
          { file: `adr/${second.name}`, status: 'Accepted' },
        ],
      ),
    ).toEqual([]);
  });
});

describe('the index', () => {
  it('rejects an ADR it does not list', () => {
    const file = accepted('0001');
    expect(findAdrProblems([file], [])).toEqual(['0001-a-decision.md: not listed in the index']);
  });

  it('rejects a row with no ADR behind it', () => {
    const file = accepted('0001');
    expect(findAdrProblems([file], [...listing(file), { file: 'adr/0002-a-ghost.md', status: 'Accepted' }])).toEqual([
      'the index lists adr/0002-a-ghost.md, which does not exist',
    ]);
  });

  it('rejects a status the index and the ADR disagree on', () => {
    const file = adr(
      '0001',
      '**Status:** Deferred\n**Date:** 2026-09-12\n**Trigger:** the second locale ships.',
    );
    expect(check(file, 'Accepted')).toEqual([
      "0001-a-decision.md: the index says 'Accepted', the ADR says 'Deferred'",
    ]);
  });
});

describe('the template', () => {
  const template = (): string => readFileSync(path.join(ADR_DIR, 'template.md'), 'utf8');

  it('rejects a template that has lost a section', () => {
    expect(findTemplateProblems(template().replace('## Rejected alternatives', '## Notes'))).toEqual(
      ["template: missing section '## Rejected alternatives'"],
    );
  });

  it('rejects a template that stops explaining a status', () => {
    expect(findTemplateProblems(template().replaceAll('Deferred', 'Pending'))).toEqual([
      "template: does not explain 'Deferred'",
    ]);
  });

  it('rejects a template that stops explaining adoption', () => {
    expect(findTemplateProblems(template().replaceAll('**Adopted:**', '**Landed:**'))).toEqual([
      "template: does not explain '**Adopted:**'",
    ]);
  });
});
