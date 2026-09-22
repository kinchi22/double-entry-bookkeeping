/**
 * The shape rules for the harness layout, as pure functions.
 *
 * ADR-0022 states the layout: one working agreement every harness reads, Skill
 * bodies outside both harness directories with a stub pointing at each, an index
 * of `docs/agents/`, vendor names confined to one file, and one table per term.
 * Each of those is a property of file contents, so each is a function from
 * contents to human-readable problems.
 *
 * Pure because the interesting cases are the broken ones. The other gates here
 * run real tooling against a fixture that is wrong on purpose, since what rots in
 * them is the tool's own path resolution. Nothing here resolves a path, so the
 * deliberate breakages are inputs in the test beside the assertion.
 *
 * Every check reports a missing input as a problem rather than a pass: this
 * repository has an agreement, stubs, an index and two glossaries, so nothing to
 * compare means the scan that produced the input broke, and a gate that passes
 * when its input goes missing is worse than no gate.
 */

/** One harness's stub for a Skill, as that harness reads it. */
export type SkillStub = {
  /** The harness whose directory holds it, e.g. `Codex`. Used in the message. */
  readonly harness: string;
  /** Repository-relative path, e.g. `.agents/skills/implement-issue/SKILL.md`. */
  readonly path: string;
  readonly content: string;
};

/** A file of shared prose: the agreement, or anything under `docs/agents/`. */
export type DocFile = {
  /** Repository-relative path, e.g. `docs/agents/issue-tracker.md`. */
  readonly path: string;
  readonly content: string;
};

/** The whole body of `CLAUDE.md`, because a rule lives in `AGENTS.md` or nowhere. */
export const WORKING_AGREEMENT_IMPORT = '@AGENTS.md';

/** The kinds `docs/agents/README.md` defines, so a reader knows how to read a file. */
export const AGENT_FILE_KINDS = ['Index', 'Reference', 'Skill body'] as const;

/** The one file ADR-0022 permits to name a harness's own directory. */
export const HARNESS_PATHS_ALLOWED_IN = 'docs/agents/harnesses.md';

const FRONTMATTER = /^---\n(.*?)\n---\n/s;
const NAME_FIELD = /^name:(.+)$/m;
const DESCRIPTION_FIELD = /^description:(.+)$/m;

/** A backticked path to a Markdown file, which is how a stub points at its body. */
const POINTER = /`([^`]+\.md)`/g;

/** A row of the index in `docs/agents/README.md`: a backticked file, then its kind. */
const INDEX_ROW = /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/gm;

/** A harness's own directory, wherever it is named. `~/.codex/` counts. */
const VENDOR_PATH = /\.(?:claude|codex)\//g;

/** A row of a two-column glossary table. A three-column mapping row is not one. */
const TERM_ROW = /^\|\s*([^|]+?)\s*\|[^|]*\|\s*$/gm;
const SEPARATOR_CELL = /^[-: ]+$/;
const TABLE_HEADINGS = ['Term', 'Concept'];

const VOCABULARY_HEADING = '\n## Vocabulary\n';

/**
 * `CLAUDE.md` holds the import and nothing else.
 *
 * Claude Code reads `AGENTS.md` natively only when no `CLAUDE.md` exists anywhere
 * up the tree, so the import is what makes the agreement arrive. A rule written
 * beside it would be a rule one harness reads and the other does not, which is
 * the whole failure ADR-0022 removes.
 */
export function findImportProblems(content: string): readonly string[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const problems: string[] = [];

  if (!lines.includes(WORKING_AGREEMENT_IMPORT)) {
    problems.push(
      `CLAUDE.md: needs the line '${WORKING_AGREEMENT_IMPORT}', which is how the working ` +
        'agreement arrives',
    );
  }

  for (const line of lines.filter((line) => line !== WORKING_AGREEMENT_IMPORT)) {
    problems.push(
      `CLAUDE.md: '${line}' is not the import, and a rule lives in AGENTS.md or nowhere`,
    );
  }

  return problems;
}

/** A field of a stub, paired with the path to report when it disagrees. */
type Field = readonly [path: string, value: string];

const disagreements = (field: string, values: readonly Field[]): readonly string[] => {
  const [first, ...rest] = values;
  if (first === undefined) return [];

  const [firstPath, firstValue] = first;
  return rest.flatMap(([path, value]) =>
    value === firstValue
      ? []
      : [`${firstPath} and ${path} disagree on ${field}: '${firstValue}' and '${value}'`],
  );
};

/**
 * The stubs agree, and each points at a body that exists.
 *
 * Neither harness reads the other's skill directory, so one Skill has two stubs
 * and neither failure shows up in the harness that still works: a renamed body
 * leaves a dead pointer, and a stub edited on one side drifts from the other.
 */
export function findStubProblems(
  stubs: readonly SkillStub[],
  skillBodies: readonly string[],
): readonly string[] {
  if (skillBodies.length === 0) {
    return [
      'no Skill body was found under docs/agents/skills/, so nothing was compared. The scan ' +
        'is broken, not the repository empty.',
    ];
  }

  const problems: string[] = [];
  if (stubs.length < 2) {
    problems.push(`a Skill needs one stub per harness, and ${String(stubs.length)} was found`);
  }

  const bodies = new Set(skillBodies);
  const names: Field[] = [];
  const descriptions: Field[] = [];

  for (const stub of stubs) {
    const frontmatter = FRONTMATTER.exec(stub.content);
    if (frontmatter?.[1] === undefined) {
      problems.push(
        `${stub.path}: has no frontmatter, so ${stub.harness} reads neither a name nor a ` +
          'description',
      );
      continue;
    }

    const name = NAME_FIELD.exec(frontmatter[1])?.[1]?.trim();
    if (name === undefined) problems.push(`${stub.path}: needs a 'name:' line`);
    else names.push([stub.path, name]);

    const description = DESCRIPTION_FIELD.exec(frontmatter[1])?.[1]?.trim();
    if (description === undefined) problems.push(`${stub.path}: needs a 'description:' line`);
    else descriptions.push([stub.path, description]);

    const body = stub.content.slice(frontmatter[0].length);
    const pointers = [...body.matchAll(POINTER)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    );

    if (pointers.length === 0) {
      problems.push(
        `${stub.path}: its body points at no Skill body, so ${stub.harness} reaches no procedure`,
      );
    }

    for (const pointer of pointers) {
      if (!bodies.has(pointer)) {
        problems.push(
          `${stub.path}: points at ${pointer}, which is not a Skill body under ` +
            'docs/agents/skills/',
        );
      }
    }
  }

  problems.push(...disagreements('name', names), ...disagreements('description', descriptions));
  return problems;
}

/**
 * The index names every file under `docs/agents/`, and nothing else.
 *
 * Both directions, as the ADR index is checked: a file missing from the table is
 * invisible to a reader who starts where the agreement points them, and a row
 * with no file behind it is the index rotted into a lie. The kind is checked too,
 * because a file listed without one tells a reader nothing about how to read it.
 */
export function findIndexProblems(
  files: readonly string[],
  index: string,
): readonly string[] {
  const rows = [...index.matchAll(INDEX_ROW)].flatMap((match) =>
    match[1] === undefined || match[2] === undefined ? [] : [{ file: match[1], kind: match[2] }],
  );

  const missingInput: string[] = [];
  if (files.length === 0) {
    missingInput.push(
      'no file was found under docs/agents/, so nothing was compared. The scan is broken, ' +
        'not the repository empty.',
    );
  }
  if (rows.length === 0) {
    missingInput.push(
      'docs/agents/README.md lists no file at all, so nothing was compared. The scan is ' +
        'broken, not the repository empty.',
    );
  }
  if (missingInput.length > 0) return missingInput;

  const problems: string[] = [];
  const kinds: readonly string[] = AGENT_FILE_KINDS;
  const listed = new Map(rows.map((row) => [row.file, row.kind]));

  for (const file of [...files].sort()) {
    const kind = listed.get(file);
    if (kind === undefined) {
      problems.push(`docs/agents/${file}: not listed in docs/agents/README.md`);
    } else if (!kinds.includes(kind)) {
      problems.push(
        `docs/agents/README.md: lists ${file} as '${kind}', which is not one of ` +
          kinds.join(', '),
      );
    }
  }

  const present = new Set(files);
  for (const row of rows) {
    if (!present.has(row.file)) {
      problems.push(`docs/agents/README.md lists ${row.file}, which does not exist`);
    }
  }

  return problems;
}

/**
 * No harness directory is named outside the one file that maps them.
 *
 * A rule that names one harness's directory is a rule the other harness cannot
 * follow, and an instruction an agent cannot literally execute reads like one it
 * may skip. So the agreement and everything it points at say what a thing is, and
 * `harnesses.md` alone says where that thing lives.
 */
export function findVendorPathProblems(files: readonly DocFile[]): readonly string[] {
  if (files.length === 0) {
    return [
      'no shared prose was found, so nothing was compared. The scan is broken, not the ' +
        'repository empty.',
    ];
  }

  const problems: string[] = [];

  for (const file of files) {
    if (file.path === HARNESS_PATHS_ALLOWED_IN) continue;

    const named = new Set([...file.content.matchAll(VENDOR_PATH)].map((match) => match[0]));
    for (const directory of [...named].sort()) {
      problems.push(
        `${file.path}: names '${directory}', and only ${HARNESS_PATHS_ALLOWED_IN} may name a ` +
          "harness's own directory",
      );
    }
  }

  return problems;
}

/** The first cell of every two-column table row, headings and separators dropped. */
const termsOf = (content: string): readonly string[] =>
  [...content.matchAll(TERM_ROW)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
    .filter((term) => !SEPARATOR_CELL.test(term) && !TABLE_HEADINGS.includes(term));

/** The prose under `## Vocabulary`, so the mapping table beside it is not read. */
const vocabularySection = (content: string): string => {
  const start = content.indexOf(VOCABULARY_HEADING);
  if (start === -1) return '';

  const from = start + VOCABULARY_HEADING.length;
  const next = content.indexOf('\n## ', from);
  return next === -1 ? content.slice(from) : content.slice(from, next);
};

/**
 * No term is defined in both glossaries.
 *
 * `docs/GLOSSARY.md` names what the product is built from and
 * `docs/agents/harnesses.md` names how it is worked on. Two tables are still one
 * index only while no term appears in both; a term defined twice is two
 * definitions free to drift, which is what "one canonical name per concept" is
 * for.
 */
export function findSharedTermProblems(
  glossary: string,
  harnesses: string,
): readonly string[] {
  const domainTerms = termsOf(glossary);
  const harnessTerms = termsOf(vocabularySection(harnesses));

  const missingInput: string[] = [];
  if (harnessTerms.length === 0) {
    missingInput.push(
      'no term was found under `## Vocabulary` in docs/agents/harnesses.md, so nothing was ' +
        'compared. The scan is broken, not the repository empty.',
    );
  }
  if (domainTerms.length === 0) {
    missingInput.push(
      'no term was found in docs/GLOSSARY.md, so nothing was compared. The scan is broken, ' +
        'not the repository empty.',
    );
  }
  if (missingInput.length > 0) return missingInput;

  const defined = new Set(harnessTerms);
  return domainTerms.flatMap((term) =>
    defined.has(term)
      ? [
          `'${term}' is defined in both docs/GLOSSARY.md and docs/agents/harnesses.md, and ` +
            'one canonical name per concept means one table per term',
        ]
      : [],
  );
}
