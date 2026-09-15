import boundaries from 'eslint-plugin-boundaries';

/**
 * The allowed dependency matrix, section 5 of the bootstrap brief, expressed as
 * eslint-plugin-boundaries configuration.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * 1. Element patterns match FOLDERS, not files. A pattern ending in `/**\/*`
 *    matches nothing, and an element that matches nothing is not "permissive" --
 *    it is invisible, and every rule about it silently stops running.
 *
 * 2. Order matters: the first matching element wins. `core-surface` is the
 *    catch-all for packages/core/src, so it must come after the four layer
 *    folders or it would swallow all of them.
 *
 * `boundaries/no-unknown-files` is switched on below so that a source file which
 * matches no element fails the build instead of quietly escaping the matrix.
 */
/**
 * pnpm links workspace packages through node_modules symlinks, and the import
 * resolver reports the symlinked path (packages/core/node_modules/@repo/db/...)
 * rather than the real one. An element pattern that only names the real path
 * therefore never matches a cross-package import: the dependency falls outside
 * `boundaries/include`, is marked ignored, and every cross-package row of the
 * matrix silently stops applying while still looking configured.
 *
 * Only the public surfaces need this treatment. The internal core layers are
 * unreachable across a package boundary because the `exports` field does not
 * expose them, so they keep their real-path-only patterns and their captures.
 */
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
  // Catch-all for packages/core/src: the package index, the server entry point,
  // and each feature index. Must stay last among the core elements.
  { type: 'core-surface', pattern: withLinkedPaths('packages/core/src') },

  { type: 'db', pattern: withLinkedPaths('packages/db/src') },
  { type: 'ui', pattern: withLinkedPaths('packages/ui/src') },

  { type: 'web-server', pattern: 'apps/web/server' },
  { type: 'web-app', pattern: 'apps/web/app' },
  { type: 'web-components', pattern: 'apps/web/components' },
  { type: 'web-messages', pattern: 'apps/web/messages' },
];

/**
 * apps/web/server/container.ts was categorised here while it was the one file
 * exempt from the dynamic-import ban. ADR-0002 removed that exemption, and with
 * it the reason to name the file: its import permissions are, and always were,
 * the same as any other file in apps/web/server.
 */
export const FILE_CATEGORIES = [{ category: 'test', pattern: '**/*.test.{ts,tsx}' }];

const WEB = ['web-server', 'web-app', 'web-components'];

const from = (...types) => ({ element: { types: { anyOf: types } } });
const allow = (...types) => [{ to: { element: { types: { anyOf: types } } } }];

export const DEPENDENCY_POLICIES = [
  // Every element may use external packages. Which external packages a given
  // layer may use is a separate question, answered by no-restricted-imports in
  // layers.mjs, where the ban can carry an explanation.
  { allow: [{ to: { module: { origin: 'external' } } }] },
  { allow: [{ to: { module: { origin: 'builtin' } } }] },

  // contracts has zero internal dependencies. That is what makes it safe for
  // everyone else to depend on. No allow entry, so `default: disallow` applies.
  { from: from('contracts'), allow: [] },

  // The core public surface re-exports from inside core. It is the one place in
  // core allowed to see every layer.
  {
    from: from('core-surface'),
    allow: allow('contracts', 'core-surface', 'core-domain', 'core-application', 'core-ports', 'core-adapters'),
  },

  // Domain is pure. It may know contracts and other domain code, nothing else.
  // In particular it may not reach the public surface, because doing so would
  // launder an adapters import through the barrel.
  { from: from('core-domain'), allow: allow('contracts', 'core-domain') },

  // Use cases depend on ports, never on the implementation behind a port.
  {
    from: from('core-application'),
    allow: allow('contracts', 'core-domain', 'core-ports', 'core-application'),
  },

  // Ports are interfaces stated in domain terms.
  { from: from('core-ports'), allow: allow('contracts', 'core-domain', 'core-ports') },

  // Adapters implement ports and are the only part of core that may touch the
  // database package.
  {
    from: from('core-adapters'),
    allow: allow('contracts', 'core-domain', 'core-ports', 'core-adapters', 'db'),
  },

  { from: from('db'), allow: allow('db') },
  { from: from('ui'), allow: allow('ui') },

  // apps/web composes. It reaches core only through the public surface, never
  // into a layer directly, and it never touches db.
  { from: from(...WEB), allow: allow('contracts', 'core-surface', 'ui', ...WEB) },

  // Copy is read where it is rendered, and the catalogue is data: nothing else
  // in the repo is imported by it, so a translation library can replace it
  // without untangling a dependency. No allow entry, so `default: disallow`
  // applies, as for contracts. ADR-0007.
  { from: from('web-app', 'web-components'), allow: allow('web-messages') },
  { from: from('web-messages'), allow: [] },
];

export const boundariesConfig = {
  name: 'repo/boundaries',
  plugins: { boundaries },
  settings: {
    // eslint-plugin-boundaries resolves imports through eslint-module-utils,
    // whose default node resolver only knows .js/.json/.node. Without these
    // extensions every relative TypeScript import resolves to nothing, is
    // classified "unknown", and the entire matrix silently stops applying.
    'import/resolver': {
      node: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      },
    },
    // Workspace packages resolve through a node_modules symlink, so by default
    // every `@repo/*` import would be classified "external" and skip the matrix
    // entirely -- the cross-package rows would look enforced and do nothing.
    // Decide externality from the import specifier instead of from the resolved
    // path: anything that is not a relative path and not `@repo/*` is external.
    'boundaries/flag-as-external': {
      inNodeModules: false,
      customSourcePatterns: ['!(@repo/**|@repo/*/**|./**|../**)'],
    },
    // Product source only. Build and tooling config files are not part of the
    // architecture and must not be forced to classify.
    'boundaries/include': [
      'packages/contracts/src/**/*',
      'packages/core/src/**/*',
      'packages/db/src/**/*',
      'packages/ui/src/**/*',
      'apps/web/app/**/*',
      'apps/web/server/**/*',
      'apps/web/components/**/*',
      'apps/web/messages/**/*',
      // The linked copies of the workspace packages, per the note above.
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
    // An unclassified source file is an unchecked source file.
    'boundaries/no-unknown-files': 'error',
    'boundaries/no-unknown-dependencies': 'error',
  },
};
