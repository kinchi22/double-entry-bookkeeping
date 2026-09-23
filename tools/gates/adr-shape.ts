/**
 * The shape rules for `docs/adr/`, as pure functions.
 *
 * Pure because the interesting cases are the broken ones. The other gates here
 * run real tooling against a fixture that is wrong on purpose, since what rots
 * in them is the tool's own path resolution. Nothing here resolves a path, so
 * the deliberate breakages are inputs in the test beside the assertion.
 */

export type AdrFile = {
  /** Base name, e.g. `0010-model-a-record-as-a-balanced-entry-of-lines.md`. */
  readonly name: string;
  readonly content: string;
};

/** One row of the index in `docs/ARCHITECTURE.md`. */
export type IndexRow = {
  /** Link target relative to `docs/`, e.g. `adr/0010-model-a-record-as-a-balanced-entry-of-lines.md`. */
  readonly file: string;
  readonly status: string;
};

const FILE_NAME = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const HEADING = /^# ADR-(\d{4}): \S/m;
const STATUS_LINE = /^\*\*Status:\*\* (.+)$/m;
const DATE_LINE = /^\*\*Date:\*\* \d{4}-\d{2}-\d{2}$/m;
const SUPERSEDED_BY = /^Superseded by ADR-(\d{4})$/;

/**
 * A deferred ADR is the one that rots. Nothing is being built from it, so
 * nothing fails when it drifts, and the reason it was deferred goes first.
 */
const TRIGGER_LINE = /^\*\*Trigger:\*\* \S/m;

/**
 * Adoption is the whole point of deferring: the record is edited in place
 * rather than replaced, so the decision and the reason it waited stay together.
 * An adopted ADR keeps its trigger and says when the wait ended.
 */
const ADOPTED_LINE = /^\*\*Adopted:\*\* (.+)$/m;
const ADOPTED_FORM = /^\d{4}-\d{2}-\d{2}, PR #\d+$/;

export const REQUIRED_SECTIONS = [
  'Problem',
  'Decision',
  'Consequences',
  'Rejected alternatives',
] as const;

export const STATUS_VOCABULARY = ['Accepted', 'Deferred', 'Superseded by ADR-NNNN'] as const;

const pad = (value: number): string => String(value).padStart(4, '0');

const numberOf = (name: string): number | undefined => {
  const match = FILE_NAME.exec(name);
  return match?.[1] === undefined ? undefined : Number(match[1]);
};

/** The prose under a `## Heading`, or undefined when the heading is absent. */
const sectionBody = (content: string, heading: string): string | undefined => {
  const marker = `\n## ${heading}\n`;
  const start = content.indexOf(marker);
  if (start === -1) return undefined;

  const from = start + marker.length;
  const next = content.indexOf('\n## ', from);
  return next === -1 ? content.slice(from) : content.slice(from, next);
};

const statusProblems = (
  file: AdrFile,
  status: string,
  knownNumbers: ReadonlySet<number>,
): readonly string[] => {
  const problems: string[] = [];

  const deferred = status === 'Deferred';
  const superseded = SUPERSEDED_BY.exec(status);
  const hasTrigger = TRIGGER_LINE.test(file.content);
  const adopted = ADOPTED_LINE.exec(file.content)?.[1];

  if (!deferred && superseded === null && status !== 'Accepted') {
    problems.push(
      `${file.name}: status '${status}' is not one of ${STATUS_VOCABULARY.join(', ')}`,
    );
    return problems;
  }

  if (superseded !== null && !knownNumbers.has(Number(superseded[1]))) {
    problems.push(`${file.name}: superseded by ADR-${superseded[1] ?? ''}, which does not exist`);
  }

  if (deferred) {
    if (!hasTrigger) problems.push(`${file.name}: a Deferred ADR needs a '**Trigger:** ...' line`);
    // Adopted and Deferred together says the record was adopted and the status
    // never followed, which is the drift this whole gate exists to catch.
    if (adopted !== undefined) problems.push(`${file.name}: adopted, but still marked Deferred`);
  } else if (superseded === null && hasTrigger && adopted === undefined) {
    // A trigger on a record that is in force means it waited and then landed.
    // A superseded one may have waited and been replaced instead, never built,
    // so it keeps its trigger and has no adoption to record.
    problems.push(`${file.name}: was deferred, so it needs an '**Adopted:** ...' line`);
  }

  if (adopted !== undefined && !ADOPTED_FORM.test(adopted)) {
    problems.push(`${file.name}: '**Adopted:** ${adopted}' is not 'YYYY-MM-DD, PR #N'`);
  }

  return problems;
};

/**
 * Every way `docs/adr/` can be wrong, as human-readable lines.
 *
 * The index check runs in both directions and covers the status column, not
 * just the link: an ADR missing from the index is invisible to a reader who
 * starts where `AGENTS.md` points them, a row pointing at nothing is a decision
 * that looks recorded and is not, and a row whose status disagrees with the
 * record is the index saying a rule is not in force when it is.
 */
export function findAdrProblems(
  files: readonly AdrFile[],
  index: readonly IndexRow[],
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

  for (const file of named) {
    const number = numberOf(file.name);
    if (number === undefined) continue;

    const heading = HEADING.exec(file.content);
    if (heading === null) {
      problems.push(`${file.name}: needs a '# ADR-NNNN: Title' heading`);
    } else if (heading[1] !== pad(number)) {
      problems.push(
        `${file.name}: heading says ADR-${heading[1] ?? ''}, file name says ADR-${pad(number)}`,
      );
    }

    if (!DATE_LINE.test(file.content)) {
      problems.push(`${file.name}: needs a '**Date:** YYYY-MM-DD' line`);
    }

    for (const section of REQUIRED_SECTIONS) {
      const body = sectionBody(file.content, section);
      if (body === undefined) problems.push(`${file.name}: missing section '## ${section}'`);
      else if (body.trim() === '') problems.push(`${file.name}: section '## ${section}' is empty`);
    }

    const status = STATUS_LINE.exec(file.content)?.[1];
    if (status === undefined) {
      problems.push(`${file.name}: needs a '**Status:** ...' line`);
      continue;
    }

    problems.push(...statusProblems(file, status, numbers));

    const row = index.find((entry) => entry.file === `adr/${file.name}`);
    if (row === undefined) problems.push(`${file.name}: not listed in the index`);
    else if (row.status !== status) {
      problems.push(`${file.name}: the index says '${row.status}', the ADR says '${status}'`);
    }
  }

  const present = new Set(named.map((file) => `adr/${file.name}`));
  for (const row of index) {
    if (!present.has(row.file)) problems.push(`the index lists ${row.file}, which does not exist`);
  }

  return problems;
}

/**
 * The template is the shape every ADR is copied from, and it is the one file the
 * checks above skip: it has no number, so it cannot be an ADR. Left unchecked it
 * drifts, and records copied from it start failing for reasons their author did
 * not introduce.
 */
export function findTemplateProblems(template: string): readonly string[] {
  const problems: string[] = [];

  for (const section of REQUIRED_SECTIONS) {
    if (sectionBody(template, section) === undefined) {
      problems.push(`template: missing section '## ${section}'`);
    }
  }

  for (const status of STATUS_VOCABULARY) {
    if (!template.includes(status)) problems.push(`template: does not explain '${status}'`);
  }

  if (!template.includes('**Trigger:**')) problems.push("template: does not explain '**Trigger:**'");
  if (!template.includes('**Adopted:**')) problems.push("template: does not explain '**Adopted:**'");

  return problems;
}
