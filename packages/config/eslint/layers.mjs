/**
 * Internal layer rules for packages/core, plus the repo-wide bans that
 * eslint-plugin-boundaries cannot express because they are about external
 * packages, syntax, or globals rather than about internal elements.
 */

const PURE_LAYER_GLOBS = [
  'packages/core/src/*/domain/**/*.ts',
  'packages/core/src/*/application/**/*.ts',
  'packages/core/src/*/ports/**/*.ts',
];

const DOMAIN_GLOBS = ['packages/core/src/*/domain/**/*.ts'];

const ALL_SOURCE_GLOBS = [
  'packages/*/src/**/*.{ts,tsx}',
  'apps/web/**/*.{ts,tsx}',
];

/**
 * Selecting a runtime implementation with import() is invisible to static
 * analysis. Confining it to the composition root shrinks the region no gate can
 * see down to a single human-reviewed file.
 */
const NO_DYNAMIC_IMPORT = {
  selector: 'ImportExpression',
  message:
    'Dynamic import() is only allowed in apps/web/server/container.ts. ' +
    'Everywhere else it hides the dependency graph from static analysis.',
};

/**
 * The domain returns Result<T, DomainError>. A thrown error is a control-flow
 * path the type system cannot see.
 */
const NO_THROW = {
  selector: 'ThrowStatement',
  message:
    'Do not throw in domain code. Return Result<T, DomainError> instead, ' +
    'so failure is part of the signature. HTTP mapping happens in tRPC routers.',
};

const forbiddenImport = (group, message) => ({ group, message });

export const layerConfigs = [
  {
    name: 'repo/no-dynamic-import',
    files: ALL_SOURCE_GLOBS,
    rules: {
      'no-restricted-syntax': ['error', NO_DYNAMIC_IMPORT],
    },
  },

  {
    name: 'repo/core-purity',
    files: PURE_LAYER_GLOBS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            forbiddenImport(
              ['drizzle-orm', 'drizzle-orm/*'],
              'Domain, application, and ports must not know the ORM. Persistence belongs behind a port, implemented in adapters/.',
            ),
            forbiddenImport(
              ['@repo/db', '@repo/db/*'],
              'Only core/*/adapters/** may import @repo/db.',
            ),
            forbiddenImport(
              ['pg', 'pg-*', 'postgres'],
              'Database drivers belong in adapters/, behind a port.',
            ),
            forbiddenImport(
              ['next', 'next/*'],
              'Core must stay runtime-agnostic so an AWS migration replaces only apps/.',
            ),
            forbiddenImport(
              ['react', 'react-dom', 'react/*', 'react-dom/*'],
              'Core must stay renderer-agnostic. UI concerns live in packages/ui or apps/web.',
            ),
            forbiddenImport(
              ['server-only', 'client-only'],
              'These markers describe a React runtime. Core does not have one.',
            ),
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Network access is an effect. Put it behind a port and implement it in adapters/.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Configuration is an input, not an ambient global. Pass it in from the composition root.',
        },
      ],
    },
  },

  {
    name: 'repo/domain-no-throw',
    files: DOMAIN_GLOBS,
    rules: {
      'no-restricted-syntax': ['error', NO_DYNAMIC_IMPORT, NO_THROW],
    },
  },

  {
    // The composition root is the one file allowed to choose implementations at
    // runtime. It is on the human review list precisely because of this.
    name: 'repo/container-exemption',
    files: ['apps/web/server/container.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
