import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bin, REPO_ROOT, runGate } from './run-gate';
import { type Collection, findCollectionProblems } from './test-collection';

const OTHER_RUNNERS = ['fixtures/', 'e2e/'];

const posix = (file: string): string => file.replaceAll('\\', '/');

const testFilesOnDisk = (): readonly string[] => {
  const run = runGate(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
      '*.test.ts',
      '*.test.tsx',
      '*.spec.ts',
      '*.spec.tsx',
    ],
    REPO_ROOT,
  );
  expect(run.status, `git ls-files must succeed\n${run.stderr}`).toBe(0);

  return run.stdout
    .split('\0')
    .filter((file) => file !== '')
    .map(posix)
    .filter((file) => !OTHER_RUNNERS.some((prefix) => file.startsWith(prefix)));
};

const vitestConfigs = (): readonly string[] =>
  readdirSync(REPO_ROOT)
    .filter((name) => /^vitest[.].*config[.]ts$/.test(name))
    .sort();

type ListedFile = { readonly file: string };

const collect = (config: string): Collection => {
  const run = runGate(
    bin('vitest'),
    ['list', '--filesOnly', '--json', '--config', config],
    REPO_ROOT,
  );
  expect(run.status, `vitest list --config ${config} must succeed\n${run.stderr}`).toBe(0);

  const listed = JSON.parse(run.stdout) as readonly ListedFile[];
  return {
    config,
    files: listed.map((entry) => posix(path.relative(REPO_ROOT, entry.file))),
  };
};

describe('the vitest projects', () => {
  const onDisk = testFilesOnDisk();
  const collections = vitestConfigs().map(collect);

  it('collect every test file in the working tree, exactly once', () => {
    expect(
      findCollectionProblems(onDisk, collections),
      'A test file no config collects never runs, and nothing else reports it.',
    ).toEqual([]);
  });

  it('are found at all, which is how this check could agree by comparing nothing', () => {
    expect(onDisk.length).toBeGreaterThan(0);
    expect(collections.length).toBeGreaterThan(0);
  });

  it('reports a file no project collects, which is how it is shown to fail', () => {
    const probe = path.join(REPO_ROOT, 'packages', 'ui', 'src', 'collection-probe.test.tsx');
    writeFileSync(
      probe,
      [
        '// Written by tools/gates/test-collection-gate.test.ts, and deleted by it.',
        '// A copy left in a working tree means that test was killed: delete this file.',
        '',
      ].join('\n'),
    );

    try {
      expect(findCollectionProblems(testFilesOnDisk(), vitestConfigs().map(collect))).toEqual([
        'packages/ui/src/collection-probe.test.tsx is collected by no vitest config, so it ' +
          'never runs. Widen an include, or delete the file.',
      ]);
    } finally {
      rmSync(probe);
    }
  });
});

const collection = (config: string, ...files: readonly string[]): Collection => ({
  config,
  files,
});

const UNIT = 'vitest.config.ts';
const INTEGRATION = 'vitest.integration.config.ts';

describe('the collection gate', () => {
  it('passes when every file on disk is collected once', () => {
    expect(
      findCollectionProblems(
        ['packages/core/src/health/domain/status.test.ts'],
        [collection(UNIT, 'packages/core/src/health/domain/status.test.ts')],
      ),
    ).toEqual([]);
  });

  it('rejects a test file no config collects, which is the bug it exists for', () => {
    expect(
      findCollectionProblems(
        ['apps/web/server/env.test.ts'],
        [collection(UNIT, 'packages/core/src/health/domain/status.test.ts')],
      ),
    ).toEqual([
      'apps/web/server/env.test.ts is collected by no vitest config, so it never runs. ' +
        'Widen an include, or delete the file.',
      'packages/core/src/health/domain/status.test.ts is collected, but the scan of the ' +
        'working tree did not find it. The two sides are looking at different trees.',
    ]);
  });

  it('rejects a config whose include has stopped matching', () => {
    const file = 'packages/core/src/money/domain/money.test.ts';
    expect(findCollectionProblems([file], [collection(UNIT)])).toEqual([
      'vitest.config.ts collects no test file at all.',
      `${file} is collected by no vitest config, so it never runs. Widen an include, or ` +
        'delete the file.',
    ]);
  });

  it('rejects a file two configs both collect, which is the exclude that was lost', () => {
    const file = 'packages/core/src/health/adapters/postgres-health-probe.integration.test.ts';
    expect(
      findCollectionProblems([file], [collection(UNIT, file), collection(INTEGRATION, file)]),
    ).toEqual([
      `${file} is collected by vitest.config.ts and vitest.integration.config.ts, so it ` +
        'runs twice. One suite is measuring the other.',
    ]);
  });

  it('reports a missing scan rather than agreeing with itself', () => {
    expect(findCollectionProblems([], [collection(UNIT, 'a.test.ts')])).toEqual([
      'no test file was found on disk, so nothing was compared. The scan is broken, not ' +
        'the repository empty.',
    ]);
  });

  it('reports a missing config list the same way', () => {
    expect(findCollectionProblems(['a.test.ts'], [])).toEqual([
      'no vitest config was found, so nothing was compared. The scan is broken, not the ' +
        'repository empty.',
    ]);
  });
});
