/**
 * The single declaration of which fixture proves which rule is alive.
 *
 * Two tests read this file and they check different directions:
 *
 * - `lint-gate.test.ts` and `dep-cruise-gate.test.ts` run the real tooling and
 *   assert every row below is actually reported. That catches a rule that has
 *   silently stopped matching.
 * - `rule-coverage-gate.test.ts` reads the shipped configuration and asserts
 *   every rule it turns on appears below, either as a fixture row or as an
 *   explicit exemption. That catches a rule added without a fixture, which is
 *   the gap the fixture rows alone cannot see.
 *
 * So a new rule fails CI until it is either given a fixture or exempted with a
 * reason. Exemptions are the escape hatch, and they are visible in review.
 */

/** Fixture path relative to `fixtures/violations`, and the rule it must trip. */
export type LintFixture = readonly [file: string, ruleId: string];

/**
 * The rule id is the coverage key, so a rule with several distinct clauses --
 * `no-restricted-syntax` bans both `throw` and `import()` -- is only counted
 * once. Both clauses still get a fixture row below, because the liveness test
 * checks rows, not keys.
 */
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
];

/**
 * Rules the repo configuration turns on that deliberately have no fixture.
 *
 * Every entry needs a reason that says why a fixture is impossible, not why it
 * is inconvenient. "Nobody got round to it" belongs in a fixture, not here.
 */
export const LINT_RULES_WITHOUT_FIXTURE: Readonly<Record<string, string>> = {
  'boundaries/no-unknown-files':
    'Unreachable by construction: every root in `boundaries/include` is covered by a ' +
    'catch-all element (packages/*/src, apps/web/{app,server,components}), so no included ' +
    'file can fail to classify. The rule is a guard for a future include entry added ' +
    'without a matching element, and a fixture for it would have to weaken the shared ' +
    'config, which would stop testing the config that actually ships.',
};

/**
 * Whole plugin namespaces the repo re-exports rather than authors.
 *
 * `repo/next` spreads the Next and react-hooks recommended presets wholesale.
 * Those rules are upstream policy: they arrive and leave with the plugin, this
 * repo makes no claim about them, and fixturing 37 of them would say nothing
 * about the architecture this directory exists to protect.
 */
export const LINT_RULE_PREFIXES_WITHOUT_FIXTURE: Readonly<Record<string, string>> = {
  '@next/next/': 'Spread from @next/eslint-plugin-next recommended + core-web-vitals.',
  'react-hooks/': 'Spread from eslint-plugin-react-hooks recommended.',
};

/** dependency-cruiser rule name, and the fixture path that must be reported. */
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
