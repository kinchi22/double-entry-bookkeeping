export type SkillStub = {
  readonly harness: string;
  readonly path: string;
  readonly content: string;
};

export type DocFile = {
  readonly path: string;
  readonly content: string;
};

export const WORKING_AGREEMENT_IMPORT = '@AGENTS.md';

export const AGENT_FILE_KINDS = ['Index', 'Reference', 'Skill body'] as const;

export const HARNESS_PATHS_ALLOWED_IN = 'docs/agents/harnesses.md';

const FRONTMATTER = /^---\n(.*?)\n---\n/s;
const NAME_FIELD = /^name:(.+)$/m;
const DESCRIPTION_FIELD = /^description:(.+)$/m;

const POINTER = /`(docs\/agents\/skills\/[^`]+\.md)`/g;

const INDEX_ROW = /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/gm;

const VENDOR_PATH = /\.(?:claude|codex)(?![\w-])/g;

const TERM_ROW = /^\|\s*([^|]+?)\s*\|/gm;
const SEPARATOR_CELL = /^[-: ]+$/;
const TABLE_HEADINGS = ['Term', 'Concept'];

const VOCABULARY_HEADING = '\n## Vocabulary\n';

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

const termsOf = (content: string): readonly string[] =>
  [...content.matchAll(TERM_ROW)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
    .filter((term) => !SEPARATOR_CELL.test(term) && !TABLE_HEADINGS.includes(term));

const vocabularySection = (content: string): string => {
  const start = content.indexOf(VOCABULARY_HEADING);
  if (start === -1) return '';

  const from = start + VOCABULARY_HEADING.length;
  const next = content.indexOf('\n## ', from);
  return next === -1 ? content.slice(from) : content.slice(from, next);
};

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
