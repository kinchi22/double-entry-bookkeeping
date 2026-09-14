import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { repoPlugin } from './plugin.mjs';

/**
 * Files the English-only rule applies to: every file ESLint lints.
 *
 * Section 2 of the brief makes the whole project English-only, test names
 * included. Its enforcement line named folders instead, and a folder list rots
 * silently: `apps/web/components`, `tools`, `e2e` and every config file went
 * unchecked because nobody added them. A catch-all has no folder to forget.
 */
const ENGLISH_ONLY_GLOBS = ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'];

/**
 * Localized copy is exempt by construction: it lives in i18n resource files,
 * which are data, not source. Keeping the exemption path-based rather than
 * rule-based means there is no way to smuggle inline copy past the gate.
 *
 * Under a catch-all these ignores are the only exemption, so a catalogue in a
 * non-English locale fails the rule without one.
 */
const I18N_GLOBS = [
  '**/i18n/**',
  '**/messages/**',
  '**/locales/**',
  '**/*.messages.ts',
];

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
      name: 'repo/english-only',
      files: ENGLISH_ONLY_GLOBS,
      ignores: I18N_GLOBS,
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
