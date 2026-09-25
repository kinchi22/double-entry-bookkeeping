export type AdrFile = {
  readonly name: string;
  readonly content: string;
};

export type IndexRow = {
  readonly file: string;
  readonly status: string;
};

const FILE_NAME = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const HEADING = /^# ADR-(\d{4}): \S/m;
const STATUS_LINE = /^\*\*Status:\*\* (.+)$/m;
const DATE_LINE = /^\*\*Date:\*\* \d{4}-\d{2}-\d{2}$/m;
const SUPERSEDED_BY = /^Superseded by ADR-(\d{4})$/;

const TRIGGER_LINE = /^\*\*Trigger:\*\* \S/m;

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
    if (adopted !== undefined) problems.push(`${file.name}: adopted, but still marked Deferred`);
  } else if (superseded === null && hasTrigger && adopted === undefined) {
    problems.push(`${file.name}: was deferred, so it needs an '**Adopted:** ...' line`);
  }

  if (adopted !== undefined && !ADOPTED_FORM.test(adopted)) {
    problems.push(`${file.name}: '**Adopted:** ${adopted}' is not 'YYYY-MM-DD, PR #N'`);
  }

  return problems;
};

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
