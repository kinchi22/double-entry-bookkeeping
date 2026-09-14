import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { repoPlugin } from './plugin.mjs';

export function createBaseConfig({ tsconfigRootDir }) {
  return [
    js.configs.recommended,

    ...tseslint.configs.strictTypeChecked.map((config) => ({
      ...config,
      files: ['**/*.{ts,tsx,mts,cts}'],
    })),

    {
      name: 'repo/ts-language-options',
      files: ['**/*.{ts,tsx,mts,cts}'],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
        globals: { ...globals.node },
      },
      rules: {
        // The brief forbids `any`. strictTypeChecked already reports it, but
        // stating it here means a future preset change cannot quietly relax it.
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        // Unused code is either a mistake or a leftover. Both are worth failing.
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },

    {
      // The brief makes the whole project English-only. A folder list here rotted:
      // apps/web/components, tools, e2e and the root and apps/web configs went
      // unchecked. `**/*` names no folder or extension to forget, and ESLint
      // treats a trailing `/*` as universal: the block applies wherever another
      // block lints and makes no file linted on its own.
      //
      // No path is exempt. The change that ships a non-English catalogue ignores
      // its exact path; a name glob like `**/messages/**` would also exempt the
      // source of any feature with that name.
      name: 'repo/english-only',
      files: ['**/*'],
      plugins: { repo: repoPlugin },
      rules: {
        'repo/no-non-ascii': 'error',
      },
    },

    {
      // Config and tooling files are plain JS and are not in any tsconfig, so
      // type-aware rules must be switched off for them or they error out.
      name: 'repo/plain-js',
      files: ['**/*.{js,mjs,cjs}'],
      languageOptions: {
        globals: { ...globals.node },
      },
      rules: { ...tseslint.configs.disableTypeChecked.rules },
    },
  ];
}
