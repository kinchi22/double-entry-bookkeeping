import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_FILE_KINDS,
  type DocFile,
  findImportProblems,
  findIndexProblems,
  findSharedTermProblems,
  findStubProblems,
  findVendorPathProblems,
  HARNESS_PATHS_ALLOWED_IN,
  type SkillStub,
} from './agents-shape';
import { REPO_ROOT } from './run-gate';

/**
 * Section 9, applied to the harness layout.
 *
 * ADR-0022 puts the working agreement in one file that every harness reads, the
 * Skill bodies outside both harness directories, and the Harness vocabulary in a
 * table of its own. None of that fails to compile when it stops holding: a rule
 * can creep back into `CLAUDE.md`, a renamed body can leave one harness with a
 * dead pointer, a new file under `docs/agents/` can go unindexed, a vendor path
 * can leak into the shared prose, and a term can end up defined twice.
 *
 * So the five properties are asserted here against the real repository. Nothing
 * below resolves a path or runs a tool, so there is no fixture: the second half
 * of this file feeds the same predicates deliberately broken inputs, and a
 * validator that quietly stopped reporting fails the suite there.
 */

const AGENTS_DIR = path.join(REPO_ROOT, 'docs', 'agents');

const read = (...segments: readonly string[]): string =>
  readFileSync(path.join(REPO_ROOT, ...segments), 'utf8');

/** Every file under `docs/agents/`, as posix paths relative to that directory. */
const agentsFiles = (dir: string = AGENTS_DIR, prefix = ''): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? agentsFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );

/**
 * One stub per harness. Listed rather than discovered: the point of the check is
 * that both exist and agree, and a scan of whichever skill directories happen to
 * be present would agree with itself after one of them was deleted.
 */
const STUB_PATHS: ReadonlyArray<readonly [harness: string, file: string]> = [
  ['Claude Code', '.claude/skills/implement-issue/SKILL.md'],
  ['Codex', '.agents/skills/implement-issue/SKILL.md'],
];

const repositoryStubs = (): readonly SkillStub[] =>
  STUB_PATHS.map(([harness, file]) => ({ harness, path: file, content: read(file) }));

const repositoryBodies = (): readonly string[] =>
  agentsFiles()
    .filter((file) => file.startsWith('skills/'))
    .map((file) => `docs/agents/${file}`);

/** The agreement and everything the agreement points at, `harnesses.md` included. */
const sharedProse = (): readonly DocFile[] => [
  { path: 'AGENTS.md', content: read('AGENTS.md') },
  ...agentsFiles().map((file) => ({
    path: `docs/agents/${file}`,
    content: read('docs', 'agents', ...file.split('/')),
  })),
];

describe('the harness layout', () => {
  it('keeps CLAUDE.md a single import of the working agreement', () => {
    expect(findImportProblems(read('CLAUDE.md'))).toEqual([]);
  });

  it('keeps both Skill stubs agreeing, and pointing at a body that exists', () => {
    expect(findStubProblems(repositoryStubs(), repositoryBodies())).toEqual([]);
  });

  it('indexes every file under docs/agents/ with a kind', () => {
    expect(findIndexProblems(agentsFiles(), read('docs', 'agents', 'README.md'))).toEqual([]);
  });

  it('keeps harness directories out of the agreement and out of docs/agents/', () => {
    expect(findVendorPathProblems(sharedProse())).toEqual([]);
  });

  it('defines no term in both glossaries', () => {
    expect(
      findSharedTermProblems(read('docs', 'GLOSSARY.md'), read('docs', 'agents', 'harnesses.md')),
    ).toEqual([]);
  });

  it('reads the files at all, which is how these checks could agree by comparing nothing', () => {
    expect(agentsFiles().length).toBeGreaterThan(0);
    expect(repositoryBodies().length).toBeGreaterThan(0);
    expect(repositoryStubs()).toHaveLength(2);
  });
});

describe('the CLAUDE.md check', () => {
  it('passes the one-line import', () => {
    expect(findImportProblems('@AGENTS.md\n')).toEqual([]);
  });

  it('rejects a rule that crept back in beside the import', () => {
    expect(findImportProblems('@AGENTS.md\n\n- No new npm dependencies.\n')).toEqual([
      "CLAUDE.md: '- No new npm dependencies.' is not the import, and a rule lives in " +
        'AGENTS.md or nowhere',
    ]);
  });

  it('rejects a file that imports nothing', () => {
    expect(findImportProblems('# Working agreement\n')).toEqual([
      "CLAUDE.md: needs the line '@AGENTS.md', which is how the working agreement arrives",
      "CLAUDE.md: '# Working agreement' is not the import, and a rule lives in AGENTS.md " +
        'or nowhere',
    ]);
  });

  it('rejects an empty file, which imports nothing either', () => {
    expect(findImportProblems('\n')).toEqual([
      "CLAUDE.md: needs the line '@AGENTS.md', which is how the working agreement arrives",
    ]);
  });
});

const CLAUDE_STUB = '.claude/skills/implement-issue/SKILL.md';
const CODEX_STUB = '.agents/skills/implement-issue/SKILL.md';
const BODY = 'docs/agents/skills/implement-issue.md';

const stubContent = (name: string, description: string, pointer = BODY): string =>
  [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    `Follow \`${pointer}\`, the Driver's brief.`,
    '',
  ].join('\n');

const NAME = 'implement-issue';
const DESCRIPTION = 'Take a Task from its issue to a merged pull request.';

const pair = (claude: string, codex: string): readonly SkillStub[] => [
  { harness: 'Claude Code', path: CLAUDE_STUB, content: claude },
  { harness: 'Codex', path: CODEX_STUB, content: codex },
];

const matching = (): readonly SkillStub[] =>
  pair(stubContent(NAME, DESCRIPTION), stubContent(NAME, DESCRIPTION));

describe('the Skill stub check', () => {
  it('passes two stubs that agree and point at a body that exists', () => {
    expect(findStubProblems(matching(), [BODY])).toEqual([]);
  });

  it('rejects stubs that disagree on the description', () => {
    const stubs = pair(stubContent(NAME, DESCRIPTION), stubContent(NAME, 'Implement an issue.'));
    expect(findStubProblems(stubs, [BODY])).toEqual([
      `${CLAUDE_STUB} and ${CODEX_STUB} disagree on description: ` +
        `'${DESCRIPTION}' and 'Implement an issue.'`,
    ]);
  });

  it('rejects stubs that disagree on the name, which is what each harness lists', () => {
    const stubs = pair(stubContent(NAME, DESCRIPTION), stubContent('implement_issue', DESCRIPTION));
    expect(findStubProblems(stubs, [BODY])).toEqual([
      `${CLAUDE_STUB} and ${CODEX_STUB} disagree on name: '${NAME}' and 'implement_issue'`,
    ]);
  });

  it('rejects a pointer left behind by a renamed body', () => {
    const stale = 'docs/agents/skills/implement-ticket.md';
    const stubs = pair(stubContent(NAME, DESCRIPTION), stubContent(NAME, DESCRIPTION, stale));
    expect(findStubProblems(stubs, [BODY])).toEqual([
      `${CODEX_STUB}: points at ${stale}, which is not a Skill body under docs/agents/skills/`,
    ]);
  });

  it('rejects a stub whose body points at nothing', () => {
    const pointless = [
      '---',
      `name: ${NAME}`,
      `description: ${DESCRIPTION}`,
      '---',
      '',
      "Follow the Driver's brief.",
      '',
    ].join('\n');
    const stubs = pair(stubContent(NAME, DESCRIPTION), pointless);
    expect(findStubProblems(stubs, [BODY])).toEqual([
      `${CODEX_STUB}: its body points at no Skill body, so Codex reaches no procedure`,
    ]);
  });

  it('rejects a stub with no frontmatter for its harness to read', () => {
    const stubs = pair(stubContent(NAME, DESCRIPTION), `Follow \`${BODY}\`.\n`);
    expect(findStubProblems(stubs, [BODY])).toEqual([
      `${CODEX_STUB}: has no frontmatter, so Codex reads neither a name nor a description`,
    ]);
  });

  it('rejects a stub missing the description its harness shows a person', () => {
    const stubs = pair(
      stubContent(NAME, DESCRIPTION),
      `---\nname: ${NAME}\n---\n\nFollow \`${BODY}\`.\n`,
    );
    expect(findStubProblems(stubs, [BODY])).toEqual([
      `${CODEX_STUB}: needs a 'description:' line`,
    ]);
  });

  it('rejects a harness that lost its stub altogether', () => {
    const [claude] = matching();
    expect(findStubProblems(claude === undefined ? [] : [claude], [BODY])).toEqual([
      'a Skill needs one stub per harness, and 1 was found',
    ]);
  });

  it('reports a missing scan of the bodies rather than agreeing with itself', () => {
    expect(findStubProblems(matching(), [])).toEqual([
      'no Skill body was found under docs/agents/skills/, so nothing was compared. The scan ' +
        'is broken, not the repository empty.',
    ]);
  });
});

const indexOf = (...rows: ReadonlyArray<readonly [file: string, kind: string]>): string =>
  [
    '| File | Kind | What it holds |',
    '| ---- | ---- | ------------- |',
    ...rows.map(([file, kind]) => `| \`${file}\` | ${kind} | Something. |`),
  ].join('\n');

const INDEXED = indexOf(
  ['README.md', 'Index'],
  ['harnesses.md', 'Reference'],
  ['skills/implement-issue.md', 'Skill body'],
);

const INDEXED_FILES = ['README.md', 'harnesses.md', 'skills/implement-issue.md'];

describe('the docs/agents index check', () => {
  it('passes an index that names every file with a kind', () => {
    expect(findIndexProblems(INDEXED_FILES, INDEXED)).toEqual([]);
  });

  it('rejects a file the index never gained', () => {
    expect(findIndexProblems([...INDEXED_FILES, 'issue-tracker.md'], INDEXED)).toEqual([
      'docs/agents/issue-tracker.md: not listed in docs/agents/README.md',
    ]);
  });

  it('rejects a row left behind by a deleted file', () => {
    expect(findIndexProblems(INDEXED_FILES.slice(0, 2), INDEXED)).toEqual([
      'docs/agents/README.md lists skills/implement-issue.md, which does not exist',
    ]);
  });

  it('rejects a kind outside the vocabulary the index itself defines', () => {
    const index = indexOf(['README.md', 'Index'], ['harnesses.md', 'Notes']);
    expect(findIndexProblems(['README.md', 'harnesses.md'], index)).toEqual([
      `docs/agents/README.md: lists harnesses.md as 'Notes', which is not one of ` +
        AGENT_FILE_KINDS.join(', '),
    ]);
  });

  it('reports an index that has stopped being a table rather than agreeing with nothing', () => {
    const untabled = '# docs/agents\n\nEverything an agent needs that is not a rule.\n';
    expect(findIndexProblems(INDEXED_FILES, untabled)).toEqual([
      'docs/agents/README.md lists no file at all, so nothing was compared. The scan is ' +
        'broken, not the repository empty.',
    ]);
  });

  it('reports a missing scan of the directory the same way', () => {
    expect(findIndexProblems([], INDEXED)).toEqual([
      'no file was found under docs/agents/, so nothing was compared. The scan is broken, ' +
        'not the repository empty.',
    ]);
  });
});

const prose = (file: string, content: string): DocFile => ({ path: file, content });

describe('the vendor path check', () => {
  it('passes prose that names a concept rather than a directory', () => {
    expect(
      findVendorPathProblems([
        prose('AGENTS.md', 'Dispatch an Implementer Subagent with the brief.\n'),
        prose('docs/agents/skills/implement-issue.md', 'Follow `docs/agents/harnesses.md`.\n'),
      ]),
    ).toEqual([]);
  });

  it('rejects a harness directory that leaked into the agreement', () => {
    expect(
      findVendorPathProblems([prose('AGENTS.md', 'The Skill lives in `.claude/skills/`.\n')]),
    ).toEqual([
      "AGENTS.md: names '.claude/', and only " +
        `${HARNESS_PATHS_ALLOWED_IN} may name a harness's own directory`,
    ]);
  });

  it('rejects one that leaked into a Skill body', () => {
    expect(
      findVendorPathProblems([
        prose('docs/agents/skills/implement-issue.md', 'Write `.codex/config.toml` first.\n'),
      ]),
    ).toEqual([
      "docs/agents/skills/implement-issue.md: names '.codex/', and only " +
        `${HARNESS_PATHS_ALLOWED_IN} may name a harness's own directory`,
    ]);
  });

  it('allows the one file whose job is to name them', () => {
    expect(
      findVendorPathProblems([
        prose(HARNESS_PATHS_ALLOWED_IN, '`.claude/skills/` and `.codex/`, mapped here.\n'),
      ]),
    ).toEqual([]);
  });

  it('reports a missing scan rather than passing an empty list', () => {
    expect(findVendorPathProblems([])).toEqual([
      'no shared prose was found, so nothing was compared. The scan is broken, not the ' +
        'repository empty.',
    ]);
  });
});

const glossaryOf = (...terms: readonly string[]): string =>
  [
    '# Glossary',
    '',
    '| Term | Meaning |',
    '| ---- | ------- |',
    ...terms.map((term) => `| ${term} | What it means. |`),
    '',
  ].join('\n');

const harnessesOf = (...terms: readonly string[]): string =>
  [
    '# Harnesses',
    '',
    '## Concept to mechanism',
    '',
    '| Concept | Claude Code | Codex |',
    '| ------- | ----------- | ----- |',
    '| Skill body | A file. | The same file. |',
    '',
    '## Vocabulary',
    '',
    '| Term | Meaning |',
    '| ---- | ------- |',
    ...terms.map((term) => `| ${term} | What it means. |`),
    '',
  ].join('\n');

describe('the two-glossary check', () => {
  it('passes tables that share no term', () => {
    expect(
      findSharedTermProblems(glossaryOf('Entry', 'Money'), harnessesOf('Harness', 'Driver')),
    ).toEqual([]);
  });

  it('rejects a term defined in both', () => {
    expect(
      findSharedTermProblems(glossaryOf('Entry', 'Skill'), harnessesOf('Harness', 'Skill')),
    ).toEqual([
      "'Skill' is defined in both docs/GLOSSARY.md and docs/agents/harnesses.md, and one " +
        'canonical name per concept means one table per term',
    ]);
  });

  it('reads the vocabulary table alone, not the mapping table beside it', () => {
    expect(findSharedTermProblems(glossaryOf('Skill body'), harnessesOf('Harness'))).toEqual([]);
  });

  it('reports a vocabulary heading that moved rather than agreeing with nothing', () => {
    const renamed = harnessesOf('Harness').replace('## Vocabulary', '## Words');
    expect(findSharedTermProblems(glossaryOf('Entry'), renamed)).toEqual([
      'no term was found under `## Vocabulary` in docs/agents/harnesses.md, so nothing was ' +
        'compared. The scan is broken, not the repository empty.',
    ]);
  });

  it('reports a domain glossary that has stopped being a table the same way', () => {
    const untabled = '# Glossary\n\nOne canonical name per concept. No synonyms.\n';
    expect(findSharedTermProblems(untabled, harnessesOf('Harness'))).toEqual([
      'no term was found in docs/GLOSSARY.md, so nothing was compared. The scan is broken, ' +
        'not the repository empty.',
    ]);
  });
});
