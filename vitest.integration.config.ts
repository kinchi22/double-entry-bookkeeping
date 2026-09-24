import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['packages/*/src/**/*.integration.test.ts'],
    globalSetup: ['tools/integration/postgres-container.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    passWithNoTests: false,
  },
});
