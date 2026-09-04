import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Unit tests only.
 *
 * Two suites are deliberately kept out. The gate-liveness suite shells out to
 * eslint, tsc, and depcruise, so it is slow and Stryker must never mistake it
 * for a test of the domain. The integration suite needs a real Postgres, and
 * `pnpm test:unit` must stay runnable without Docker.
 */
export default defineConfig({
  test: {
    name: 'unit',
    include: ['packages/*/src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
