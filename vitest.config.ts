import { defineConfig } from 'vitest/config';

/**
 * Unit and integration tests only.
 *
 * The gate-liveness suite is deliberately kept in a separate config: it shells
 * out to eslint, tsc, and depcruise, so it is slow, and Stryker must never pick
 * it up as a test of the domain.
 */
export default defineConfig({
  test: {
    name: 'unit',
    include: ['packages/*/src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
