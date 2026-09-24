export type LintFixture = readonly [file: string, ruleId: string];

export const LINT_FIXTURES: readonly LintFixture[] = [
  ['packages/core/src/ledger/domain/imports-adapters.ts', 'boundaries/dependencies'],
  ['packages/core/src/ledger/adapters/imports-web.ts', 'boundaries/dependencies'],
  ['packages/core/src/ledger/domain/imports-unknown.ts', 'boundaries/no-unknown-dependencies'],
  ['packages/core/src/ledger/domain/imports-drizzle.ts', 'no-restricted-imports'],
  ['packages/core/src/ledger/domain/imports-uuid.ts', 'no-restricted-imports'],
  ['packages/core/src/ledger/domain/uses-fetch.ts', 'no-restricted-globals'],
  ['packages/core/src/ledger/domain/uses-process-env.ts', 'no-restricted-properties'],
  ['packages/core/src/ledger/domain/throws.ts', 'no-restricted-syntax'],
  ['packages/core/src/ledger/domain/dynamic-import.ts', 'no-restricted-syntax'],
  ['packages/core/src/ledger/domain/non-ascii.ts', 'repo/no-non-ascii'],
  ['packages/core/src/ledger/domain/comment.ts', 'repo/no-comments'],
  ['packages/core/src/ledger/domain/directive-without-reason.ts', 'repo/no-comments'],
  ['packages/core/src/ledger/domain/explicit-any.ts', '@typescript-eslint/no-explicit-any'],
  [
    'packages/core/src/ledger/domain/value-type-import.ts',
    '@typescript-eslint/consistent-type-imports',
  ],
  [
    'packages/core/src/ledger/domain/untyped-boundary.ts',
    '@typescript-eslint/explicit-module-boundary-types',
  ],
  ['packages/core/src/ledger/domain/unused-binding.ts', '@typescript-eslint/no-unused-vars'],
  ['apps/web/server/reads-process-env.ts', 'no-restricted-properties'],
  ['apps/web/server/routers/fat-handler.ts', 'max-lines-per-function'],
  ['apps/web/server/routers/branchy-handler.ts', 'complexity'],
  ['apps/web/messages/imports-server.ts', 'boundaries/dependencies'],
  ['apps/web/components/inline-text.tsx', 'repo/no-inline-copy'],
  ['apps/web/components/inline-attribute.tsx', 'repo/no-inline-copy'],
  ['apps/web/app/inline-expression.tsx', 'repo/no-inline-copy'],
  ['apps/web/app/inline-metadata.ts', 'repo/no-inline-copy'],
];

export const LINT_RULES_WITHOUT_FIXTURE: Readonly<Record<string, string>> = {
  'boundaries/no-unknown-files':
    'Unreachable by construction: every root in `boundaries/include` is covered by a ' +
    'catch-all element (packages/*/src, apps/web/{app,server,components,messages}), so no included ' +
    'file can fail to classify. The rule is a guard for a future include entry added ' +
    'without a matching element, and a fixture for it would have to weaken the shared ' +
    'config, which would stop testing the config that actually ships.',
};

export const LINT_RULE_PREFIXES_WITHOUT_FIXTURE: Readonly<Record<string, string>> = {
  '@next/next/': 'Spread from @next/eslint-plugin-next recommended + core-web-vitals.',
  'react-hooks/': 'Spread from eslint-plugin-react-hooks recommended.',
};

export type DepCruiseFixture = readonly [ruleName: string, file: string];

export const DEP_CRUISE_FIXTURES: readonly DepCruiseFixture[] = [
  ['no-circular', 'packages/core/src/ledger/domain/cycle-a.ts'],
  ['no-orphans', 'packages/core/src/ledger/domain/orphan.ts'],
  ['domain-is-pure', 'packages/core/src/ledger/domain/imports-adapters.ts'],
  ['application-not-to-adapters', 'packages/core/src/ledger/application/uses-adapter.ts'],
  ['only-adapters-touch-db', 'packages/core/src/ledger/application/uses-db.ts'],
  ['core-not-to-app', 'packages/core/src/ledger/adapters/imports-web.ts'],
  ['contracts-is-a-leaf', 'packages/contracts/src/imports-core.ts'],
  ['ui-is-domain-agnostic', 'packages/ui/src/imports-core.ts'],
  ['web-not-to-db', 'apps/web/server/uses-db.ts'],
  ['not-to-unresolvable', 'packages/core/src/ledger/domain/imports-unknown.ts'],
];

export const DEP_CRUISE_RULES_WITHOUT_FIXTURE: Readonly<Record<string, string>> = {
  'no-dev-dep-in-src':
    'Unreachable in the fixture tree: it has no node_modules of its own, so every external ' +
    'import resolves up into the repo root node_modules, which the shipped config excludes ' +
    'from the graph. The dependency is dropped before the rule sees it. Reaching this rule ' +
    'would need the fixture tree to become an installed workspace package, which would ' +
    'change resolution for every other fixture here.',
};
