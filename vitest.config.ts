import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit',
    include: ['{packages,apps}/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
