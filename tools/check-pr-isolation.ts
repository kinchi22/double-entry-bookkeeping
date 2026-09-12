import { readFileSync } from 'node:fs';

/**
 * The isolation rule for `e2e/`: a pure function, plus a CLI entry point.
 *
 * `e2e/` holds the requirements, stated as executable specs, and they land
 * before the behaviour they describe. A change that edits a spec and the code
 * the spec judges, in one pull request, can make a failing requirement pass by
 * rewriting the requirement -- and the reviewer of that pull request sees the
 * spec edit sitting next to the fix that motivates it. So the two never travel
 * together. See ADR-0002.
 *
 * The one exception is the integration pull request, where a milestone branch
 * meets `main`: it carries a whole milestone, specs and behaviour together,
 * because both halves were already reviewed on the way in.
 *
 * The decision is a function over a list of paths and two branch names, because
 * that is the part that can be wrong. Everything impure -- asking GitHub which
 * files the pull request touches -- is one pipe in `.github/workflows/ci.yml`.
 */

/** Everything under here is a requirement, not code. */
export const SPEC_ROOT = 'e2e/';

export const TRUNK = 'main';

/**
 * A milestone branch holds one acceptance criterion: its specs, then the
 * behaviour that turns them green. The pattern is narrow on purpose, since a
 * branch name is what switches the rule below off.
 */
const MILESTONE = /^milestone\/[a-z0-9][a-z0-9-]*$/;

export type PullRequest = {
  /** Branch the change is on, e.g. `milestone/ledger-entry`. */
  readonly head: string;
  /** Branch it would merge into. */
  readonly base: string;
  /** Every path the pull request touches, old names of renames included. */
  readonly files: readonly string[];
};

const isSpec = (file: string): boolean => file.startsWith(SPEC_ROOT);

/**
 * Whether this is a milestone meeting the trunk, in either direction: the
 * integration pull request, or the sync that keeps the milestone current.
 */
export function isIntegration({ head, base }: Pick<PullRequest, 'head' | 'base'>): boolean {
  return (
    (MILESTONE.test(head) && base === TRUNK) || (head === TRUNK && MILESTONE.test(base))
  );
}

/**
 * Every way a pull request can break the rule, as readable lines.
 *
 * An empty file list is a problem rather than a pass, and it is checked before
 * the exemption: a pull request changes at least one file, so nothing to check
 * means the query that produced this list failed, and a gate that passes when
 * its input goes missing is worse than no gate.
 */
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
    'The spec goes in its own pull request onto the milestone branch, and it lands first.',
    ...specs.map((file) => `  spec:  ${file}`),
    ...rest.map((file) => `  other: ${file}`),
  ];
}

if (import.meta.main) {
  // Branch names as arguments, paths on stdin, so the caller decides where the
  // list comes from: the pull request files API in CI, `git diff --name-only`
  // locally.
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
