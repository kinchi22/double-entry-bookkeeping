import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * apps/web only. Core packages must never see React or Next rules, because they
 * must never see React or Next.
 */
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
      // App Router only. This rule scans for a pages/ directory and warns on
      // every run when it does not find one.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    // Route handlers and Server Actions do three things: parse input, invoke a
    // use case, map the response. Anything longer is a design violation, so the
    // gate is a size limit rather than a style preference.
    name: 'repo/thin-route-handlers',
    files: ['apps/web/server/routers/**/*.ts', 'apps/web/app/api/**/*.ts'],
    rules: {
      'max-lines-per-function': [
        'error',
        { max: 20, skipBlankLines: true, skipComments: true },
      ],
      complexity: ['error', 4],
    },
  },
];
