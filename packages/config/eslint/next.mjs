import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { repoPlugin } from './plugin.mjs';

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
    files: [
      'apps/web/server/routers/**/*.ts',
      'apps/web/app/api/**/*.ts',
      // Server Actions are the other half of the same rule: an action parses
      // input, invokes a use case and maps the response, exactly like a
      // procedure. Without this glob the size cap would apply to one write path
      // and not the other, which is how logic finds somewhere to accumulate.
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
    // `apps/web/server/env.ts` states what this app reads from the environment,
    // and `container.ts` is its one caller. That was documentation before this
    // rule existed, and documentation does not stop the next file reading
    // `process.env` directly and skipping validation entirely -- which is the
    // whole failure ADR-0005 is about, reintroduced one import at a time.
    //
    // The same rule id is on in layers.mjs for a different reason: in
    // `packages/core` configuration is an argument and never ambient. Here it is
    // ambient in exactly one file.
    //
    // Product source only. `next.config.ts` is build configuration, not part of
    // the application, and reads `NEXT_DIST_DIR` legitimately -- the same
    // exemption `packages/db/drizzle.config.ts` has.
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
    // Copy lives in apps/web/messages/en.ts (ADR-0007), so adopting a second
    // locale (ADR-0008) swaps imports for translation calls instead of hunting
    // strings through JSX. `app` and `components` are where copy is rendered;
    // packages/ui takes its text as props and renders none of its own.
    name: 'repo/copy-in-the-catalogue',
    files: ['apps/web/app/**/*.{ts,tsx}', 'apps/web/components/**/*.{ts,tsx}'],
    plugins: { repo: repoPlugin },
    rules: {
      'repo/no-inline-copy': 'error',
    },
  },
  {
    // A Server Action must be declared async because the framework requires it,
    // not because it awaits anything, so require-await's premise does not hold
    // in these files. The rule stays on everywhere else.
    name: 'repo/server-actions',
    files: ['apps/web/app/**/actions.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
];
