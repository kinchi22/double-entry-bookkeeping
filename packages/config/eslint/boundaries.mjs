import boundaries from 'eslint-plugin-boundaries';

const LINKED = {
  'packages/contracts': '@repo/contracts',
  'packages/core': '@repo/core',
  'packages/db': '@repo/db',
  'packages/ui': '@repo/ui',
};

function withLinkedPaths(pattern) {
  const patterns = [pattern];
  for (const [directory, packageName] of Object.entries(LINKED)) {
    if (pattern.startsWith(`${directory}/`)) {
      patterns.push(pattern.replace(directory, `**/node_modules/${packageName}`));
    }
  }
  return patterns;
}

export const ELEMENTS = [
  { type: 'contracts', pattern: withLinkedPaths('packages/contracts/src') },

  { type: 'core-domain', pattern: 'packages/core/src/*/domain', capture: ['feature'] },
  { type: 'core-application', pattern: 'packages/core/src/*/application', capture: ['feature'] },
  { type: 'core-ports', pattern: 'packages/core/src/*/ports', capture: ['feature'] },
  { type: 'core-adapters', pattern: 'packages/core/src/*/adapters', capture: ['feature'] },
  { type: 'core-surface', pattern: withLinkedPaths('packages/core/src') },

  { type: 'db', pattern: withLinkedPaths('packages/db/src') },
  { type: 'ui', pattern: withLinkedPaths('packages/ui/src') },

  { type: 'web-server', pattern: 'apps/web/server' },
  { type: 'web-app', pattern: 'apps/web/app' },
  { type: 'web-components', pattern: 'apps/web/components' },
  { type: 'web-messages', pattern: 'apps/web/messages' },
];

export const FILE_CATEGORIES = [{ category: 'test', pattern: '**/*.test.{ts,tsx}' }];

const WEB = ['web-server', 'web-app', 'web-components'];

const from = (...types) => ({ element: { types: { anyOf: types } } });
const allow = (...types) => [{ to: { element: { types: { anyOf: types } } } }];

export const DEPENDENCY_POLICIES = [
  { allow: [{ to: { module: { origin: 'external' } } }] },
  { allow: [{ to: { module: { origin: 'builtin' } } }] },

  { from: from('contracts'), allow: [] },

  {
    from: from('core-surface'),
    allow: allow('contracts', 'core-surface', 'core-domain', 'core-application', 'core-ports', 'core-adapters'),
  },

  { from: from('core-domain'), allow: allow('contracts', 'core-domain') },

  {
    from: from('core-application'),
    allow: allow('contracts', 'core-domain', 'core-ports', 'core-application'),
  },

  { from: from('core-ports'), allow: allow('contracts', 'core-domain', 'core-ports') },

  {
    from: from('core-adapters'),
    allow: allow('contracts', 'core-domain', 'core-ports', 'core-adapters', 'db'),
  },

  { from: from('db'), allow: allow('db') },
  { from: from('ui'), allow: allow('ui') },

  { from: from(...WEB), allow: allow('contracts', 'core-surface', 'ui', ...WEB) },

  { from: from('web-app', 'web-components'), allow: allow('web-messages') },
  { from: from('web-messages'), allow: [] },
];

export const boundariesConfig = {
  name: 'repo/boundaries',
  plugins: { boundaries },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      },
    },
    'boundaries/flag-as-external': {
      inNodeModules: false,
      customSourcePatterns: ['!(@repo/**|@repo/*/**|./**|../**)'],
    },
    'boundaries/include': [
      'packages/contracts/src/**/*',
      'packages/core/src/**/*',
      'packages/db/src/**/*',
      'packages/ui/src/**/*',
      'apps/web/app/**/*',
      'apps/web/server/**/*',
      'apps/web/components/**/*',
      'apps/web/messages/**/*',
      '**/node_modules/@repo/*/src/**/*',
    ],
    'boundaries/elements': ELEMENTS,
    'boundaries/files': FILE_CATEGORIES,
  },
  rules: {
    'boundaries/dependencies': [
      'error',
      {
        default: 'disallow',
        policies: DEPENDENCY_POLICIES,
      },
    ],
    'boundaries/no-unknown-files': 'error',
    'boundaries/no-unknown-dependencies': 'error',
  },
};
