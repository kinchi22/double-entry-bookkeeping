/**
 * The coverage floor.
 *
 * There is no line-coverage gate in this repository and there is deliberately no
 * `@vitest/coverage-v8`. The mutation score is the stronger statement: a file
 * nobody tests scores 0 and drags the total under the break threshold, so
 * widening `mutate` is how coverage is required, and a percentage that looks fine
 * while every assertion is `expect(spy).toHaveBeenCalled()` cannot happen.
 * ADR-0004 records that, and `fixtures/mutation/` is the proof it holds.
 *
 * `mutate` is patterns rather than a list of files, in both directions:
 *
 * - a new feature's `domain/` and `application/`, a new file in `contracts`, and
 *   a testable new file under `apps/web/server` are all measured the moment they
 *   exist, with no edit here. A glob that has to be extended by hand is a glob
 *   that silently stops covering things, which is the failure ADR-0003 was
 *   written about.
 * - the exclusions are named, so each one is a claim a reader can check.
 *
 * Every exclusion below is a file no unit test can import, not a file whose
 * tests are missing. They reach `apps/web/server/container.ts`, which imports
 * `server-only`, whose `exports` resolve to a module whose entire body is a
 * `throw` outside a React server runtime. The E2E suite is what covers them, and
 * ADR-0004 states that consequence rather than leaving it as a gap.
 *
 * So if the score breaks because a file here scores 0, the fix is a test. Adding
 * a name to the exclusions is the move that is not quietly available: this file is
 * an owned path in `.github/CODEOWNERS`, and both branch rulesets set
 * `require_code_owner_review`, so a pull request that edits it pulls the owner in
 * -- on a milestone branch too, where nothing else does.
 *
 * A feature's `ports` and `adapters` folders are absent on purpose. A port is an
 * interface and has no mutants; an adapter is tested against a real Postgres by
 * `*.integration.test.ts`, which this runner does not run, so mutating one would
 * score 0 and measure nothing. `apps/web/app/**` is absent for the same reason as
 * the exclusions: a page and a Server Action both reach the composition root.
 */

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'pnpm',
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  // The unit project, so `test:mutation` measures exactly what `test:unit` runs.
  vitest: { configFile: 'vitest.config.ts' },
  mutate: [
    'packages/core/src/*/{domain,application}/**/*.ts',
    'packages/contracts/src/**/*.ts',
    'apps/web/server/**/*.ts',
    '!apps/web/server/{container,context,trpc,root-router}.ts',
    '!apps/web/server/routers/**',
    '!**/*.test.ts',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['progress', 'clear-text', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 95, low: 90, break: 90 },
  tempDirName: '.stryker-tmp',
};
