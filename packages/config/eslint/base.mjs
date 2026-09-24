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
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },

    {
      name: 'repo/english-only',
      files: ['**/*'],
      plugins: { repo: repoPlugin },
      rules: {
        'repo/no-non-ascii': 'error',
      },
    },

    {
      name: 'repo/no-comments',
      files: ['**/*'],
      plugins: { repo: repoPlugin },
      rules: {
        'repo/no-comments': 'error',
      },
    },

    {
      name: 'repo/plain-js',
      files: ['**/*.{js,mjs,cjs}'],
      languageOptions: {
        globals: { ...globals.node },
      },
      rules: { ...tseslint.configs.disableTypeChecked.rules },
    },
  ];
}
