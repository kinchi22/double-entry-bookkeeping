import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: path.resolve(import.meta.dirname, '..', '..'),
  test: {
    name: 'mutation-fixture',
    include: ['fixtures/mutation/*.test.ts'],
    environment: 'node',
  },
});
