import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { repoPlugin } from './plugin.mjs';

export const nextConfigs = [
  {
    name: 'repo/next',
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    name: 'repo/thin-route-handlers',
    files: [
      'apps/web/server/routers/**/*.ts',
      'apps/web/app/api/**/*.ts',
      'apps/web/app/**/actions.ts',
    ],
    rules: {
      'max-lines-per-function': [
        'error',
        { max: 20, skipBlankLines: true, skipComments: true },
      ],
      complexity: ['error', 4],
    },
  },
  {
    name: 'repo/one-reader-of-the-environment',
    files: [
      'apps/web/server/**/*.ts',
      'apps/web/app/**/*.{ts,tsx}',
      'apps/web/components/**/*.{ts,tsx}',
    ],
    ignores: ['apps/web/server/container.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'The environment is read in apps/web/server/container.ts and nowhere else, through parseEnv in apps/web/server/env.ts. Add the variable to the schema there. ADR-0005.',
        },
      ],
    },
  },
  {
    name: 'repo/copy-in-the-catalogue',
    files: ['apps/web/app/**/*.{ts,tsx}', 'apps/web/components/**/*.{ts,tsx}'],
    plugins: { repo: repoPlugin },
    rules: {
      'repo/no-inline-copy': 'error',
    },
  },
  {
    name: 'repo/server-actions',
    files: ['apps/web/app/**/actions.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
];
