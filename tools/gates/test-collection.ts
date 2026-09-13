/**
 * Which test files the vitest projects actually run, as a pure function.
 *
 * `passWithNoTests: false` is the liveness guard each config carries, and it
 * only catches a run that collected nothing at all. A glob that stops matching
 * one subtree -- a package renamed, a test moved out of `src/`, a new config
 * nobody added the directory to -- collects fewer files and stays green, which
 * is the failure this repo exists to prevent, applied to the test suite itself.
 * The unit include was `packages/<pkg>/src/**` until ADR-0003 and matched
 * nothing under `apps/`; nothing failed, because there was nothing there yet.
 *
 * So the check is a comparison rather than a pattern: every test file on disk
 * against every file the configs report collecting. Both sides are gathered by
 * the test beside this file, since what can rot there is a spawn and a path,
 * and what can be wrong here is the comparison.
 */

/** A vitest config, and the test files it says it collects. */
export type Collection = {
  /** Config file name, e.g. `vitest.config.ts`. */
  readonly config: string;
  /** Repository-relative paths, in posix form. */
  readonly files: readonly string[];
};

const sorted = (values: Iterable<string>): readonly string[] => [...values].sort();

/**
 * Every way the test surface and the files on disk can disagree, as readable
 * lines. An empty side is a problem rather than a pass: this repository has
 * test files and vitest configs, so nothing to compare means the scan that
 * produced the list broke, and a gate that passes when its input goes missing
 * is worse than no gate.
 */
export function findCollectionProblems(
  onDisk: readonly string[],
  collections: readonly Collection[],
): readonly string[] {
  const missingInput: string[] = [];
  if (collections.length === 0) {
    missingInput.push(
      'no vitest config was found, so nothing was compared. The scan is broken, ' +
        'not the repository empty.',
    );
  }
  if (onDisk.length === 0) {
    missingInput.push(
      'no test file was found on disk, so nothing was compared. The scan is broken, ' +
        'not the repository empty.',
    );
  }
  if (missingInput.length > 0) return missingInput;

  const configsByFile = new Map<string, string[]>();
  for (const collection of collections) {
    for (const file of collection.files) {
      configsByFile.set(file, [...(configsByFile.get(file) ?? []), collection.config]);
    }
  }

  const problems: string[] = [];

  for (const { config, files } of collections) {
    if (files.length === 0) {
      problems.push(`${config} collects no test file at all.`);
    }
  }

  for (const file of sorted(onDisk)) {
    if (!configsByFile.has(file)) {
      problems.push(
        `${file} is collected by no vitest config, so it never runs. Widen an ` +
          `include, or delete the file.`,
      );
    }
  }

  const known = new Set(onDisk);
  for (const file of sorted(configsByFile.keys())) {
    if (!known.has(file)) {
      problems.push(
        `${file} is collected, but the scan of the working tree did not find it. ` +
          `The two sides are looking at different trees.`,
      );
    }
  }

  for (const file of sorted(configsByFile.keys())) {
    const configs = configsByFile.get(file) ?? [];
    if (configs.length > 1) {
      problems.push(
        `${file} is collected by ${sorted(configs).join(' and ')}, so it runs twice. ` +
          `One suite is measuring the other.`,
      );
    }
  }

  return problems;
}
