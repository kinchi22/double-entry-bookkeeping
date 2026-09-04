import { defineConfig } from 'vitest/config';

/**
 * Integration tests: real adapters against a real Postgres.
 *
 * Separate from the unit config for two reasons. Stryker runs the unit config,
 * and mutating domain code against a suite that spends its time on IO would be
 * both slow and meaningless. And these tests need a container, so they must not
 * be able to make `pnpm test:unit` depend on Docker.
 *
 * `passWithNoTests: false` is the liveness guard: if the naming convention ever
 * drifts and the glob stops matching, the gate fails instead of reporting a
 * green run over zero tests.
 */
export default defineConfig({
  test: {
    name: 'integration',
    include: ['packages/*/src/**/*.integration.test.ts'],
    globalSetup: ['tools/integration/postgres-container.ts'],
    environment: 'node',
    // One container is shared by the whole run, so files take turns.
    fileParallelism: false,
    testTimeout: 30_000,
    // Pulling the image on a cold machine is the slow part, not the test.
    hookTimeout: 180_000,
    passWithNoTests: false,
  },
});
