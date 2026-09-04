import { createEslintConfig } from '@repo/config/eslint';

/**
 * The fixture tree is a miniature copy of the repo root, and this config is the
 * production preset with nothing switched off.
 *
 * That matters: eslint-plugin-boundaries element patterns are relative to the
 * working directory, so the only way to test them honestly is to run from a root
 * whose layout matches the real one. A fixture config with its own relaxed
 * patterns would prove nothing about the real gate.
 */
export default createEslintConfig({ tsconfigRootDir: import.meta.dirname });
