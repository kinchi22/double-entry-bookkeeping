import { defineConfig } from 'vitest/config';

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
