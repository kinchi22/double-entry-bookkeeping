import { readFileSync } from 'node:fs';

export const SPEC_ROOT = 'e2e/';

export const TRUNK = 'main';

const MILESTONE = /^milestone\/[a-z0-9][a-z0-9-]*$/;

export type PullRequest = {
  readonly head: string;
  readonly base: string;
  readonly files: readonly string[];
};

const isSpec = (file: string): boolean => file.startsWith(SPEC_ROOT);

export function isIntegration({ head, base }: Pick<PullRequest, 'head' | 'base'>): boolean {
  return (
    (MILESTONE.test(head) && base === TRUNK) || (head === TRUNK && MILESTONE.test(base))
  );
}

export function findIsolationProblems(pr: PullRequest): readonly string[] {
  const changed = [...new Set(pr.files)].sort();

  if (changed.length === 0) {
    return [
      'no changed files were reported. A pull request changes at least one file, ' +
        'so this list is missing rather than empty.',
    ];
  }

  if (isIntegration(pr)) return [];

  const specs = changed.filter(isSpec);
  const rest = changed.filter((file) => !isSpec(file));
  if (specs.length === 0 || rest.length === 0) return [];

  return [
    `a pull request changes ${SPEC_ROOT} or the rest of the repository, never both.`,
    'The spec goes in its own pull request: onto the milestone branch, where it lands first, or onto main for a criterion the app already meets.',
    ...specs.map((file) => `  spec:  ${file}`),
    ...rest.map((file) => `  other: ${file}`),
  ];
}

if (import.meta.main) {
  const [head = '', base = ''] = process.argv.slice(2);

  const files = readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const problems = findIsolationProblems({ head, base, files });
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }

  const count = `${String(files.length)} changed files`;
  console.log(
    isIntegration({ head, base })
      ? `${count}: ${head} -> ${base} is a milestone meeting the trunk, which carries both halves`
      : `${count}, and they stay on one side of ${SPEC_ROOT}`,
  );
}
