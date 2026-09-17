import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Unit tests, wherever they live.
 *
 * The include covers `packages` and `apps` as one glob. It used to name each
 * package's `src` directory, which matched nothing under `apps/` and nothing
 * outside a `src/` -- and a glob that stops matching a subtree does not fail.
 * `passWithNoTests: false` only notices a run that collected nothing at all, so
 * a whole directory of tests can go unrun while the suite stays green.
 * `tools/gates/test-collection-gate.test.ts` closes that by comparing the test
 * files on disk against the files these configs actually collect. See ADR-0003.
 *
 * `.tsx` is absent on purpose. There are no component tests: `packages/ui` is
 * presentational, and the client components in `apps/web/components` are
 * covered by the E2E suite, so nothing here needs jsdom or a testing library. A `*.test.tsx` file is
 * therefore collected by nothing and fails the collection gate, which is how
 * that decision is enforced rather than merely written down.
 *
 * Two suites are deliberately kept out. The gate-liveness suite shells out to
 * eslint, tsc, and depcruise, so it is slow and Stryker must never mistake it
 * for a test of the domain. The integration suite needs a real Postgres, and
 * `pnpm test:unit` must stay runnable without Docker.
 */
export default defineConfig({
  test: {
    name: 'unit',
    include: ['{packages,apps}/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
