import type { Stryker } from '@stryker-mutator/core';

type StrykerOptions = ConstructorParameters<typeof Stryker>[0];

export default {
  packageManager: 'pnpm',
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: [
    'packages/core/src/*/{domain,application}/**/*.ts',
    'packages/contracts/src/**/*.ts',
    'apps/web/server/**/*.ts',
    '!apps/web/server/{container,context,trpc,root-router}.ts',
    '!apps/web/server/routers/**',
    '!**/*.test.ts',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['progress', 'clear-text', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 95, low: 90, break: 90 },
  tempDirName: '.stryker-tmp',
} satisfies StrykerOptions;
