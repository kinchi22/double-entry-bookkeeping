import { defineConfig } from 'vitest/config';

/**
 * Section 9 of the brief: proof that each gate is alive.
 *
 * These tests run real tooling against deliberately broken fixtures, so they are
 * slow and single-threaded rather than parallel.
 */
export default defineConfig({
  test: {
    name: 'gates',
    include: ['tools/gates/**/*.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    passWithNoTests: false,
  },
});
