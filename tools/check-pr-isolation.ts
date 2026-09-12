import { readFileSync } from 'node:fs';

/**
 * The isolation rule for `e2e/`: a pure function, plus a CLI entry point.
 *
 * `e2e/` holds the requirements, stated as executable specs. A change that edits
 * a spec and the code the spec judges, in one pull request, can make a failing
 * requirement pass by rewriting the requirement -- and the reviewer of that pull
 * request sees the spec edit sitting next to the fix that motivates it. So the
 * two never travel together. See ADR-0002.
 *
 * The decision is a function over a list of paths because that is the part that
 * can be wrong. Everything impure -- asking GitHub which files the pull request
 * touches -- is one pipe in `.github/workflows/ci.yml`.
 */

/** Everything under here is a requirement, not code. */
export const SPEC_ROOT = 'e2e/';

const isSpec = (file: string): boolean => file.startsWith(SPEC_ROOT);

/**
 * Every way a pull request's file list can break the rule, as readable lines.
 *
 * An empty list is a problem rather than a pass. A pull request changes at least
 * one file, so nothing to check means the query that produced this list failed,
 * and a gate that passes when its input goes missing is worse than no gate.
 */
export function findIsolationProblems(files: readonly string[]): readonly string[] {
  const changed = [...new Set(files)].sort();

  if (changed.length === 0) {
    return [
      'no changed files were reported. A pull request changes at least one file, ' +
        'so this list is missing rather than empty.',
    ];
  }

  const specs = changed.filter(isSpec);
  const rest = changed.filter((file) => !isSpec(file));
  if (specs.length === 0 || rest.length === 0) return [];

  return [
    `a pull request changes ${SPEC_ROOT} or the rest of the repository, never both. ` +
      'Split it into two, spec last.',
    ...specs.map((file) => `  spec:  ${file}`),
    ...rest.map((file) => `  other: ${file}`),
  ];
}

if (import.meta.main) {
  // Paths arrive on stdin, one per line, so the caller decides where the list
  // comes from: the pull request files API in CI, `git diff --name-only` locally.
  const lines = readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const problems = findIsolationProblems(lines);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }

  console.log(`${String(lines.length)} changed files, and they stay on one side of ${SPEC_ROOT}`);
}
