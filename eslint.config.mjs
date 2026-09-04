import { createEslintConfig } from '@repo/config/eslint';

/**
 * One ESLint run for the whole monorepo.
 *
 * Per-package configs would defeat eslint-plugin-boundaries: the dependency
 * matrix is a statement about imports that cross package lines, so the linter
 * has to see both sides at once.
 *
 * fixtures/ is ignored here on purpose. It contains code that is supposed to
 * fail, and it is linted separately by the gate-liveness suite using this same
 * preset, from its own directory root.
 */
export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['fixtures/**'],
});
