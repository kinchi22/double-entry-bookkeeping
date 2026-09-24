export type Collection = {
  readonly config: string;
  readonly files: readonly string[];
};

const sorted = (values: Iterable<string>): readonly string[] => [...values].sort();

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
