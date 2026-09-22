# ADR-0003: Collect every test file, wherever it lives

**Status:** Accepted
**Date:** 2026-09-13

## Problem

`vitest.config.ts` collected `packages/<pkg>/src/**/*.test.ts`, and each config
carries `passWithNoTests: false` as its liveness guard. That guard only catches a
run that collected nothing at all. A subtree that stops matching -- a package
renamed, a test written outside `src/`, a directory the glob never covered --
makes the suite collect fewer files and exit 0, which is indistinguishable from a
suite that ran everything.

So the one place with no gate behind it was the gates themselves. This
repository's design is that a rule which does not fail the build is not a rule,
and "every test in this repository runs" was a rule nothing checked.

Nothing under `apps/` was collected at all. No test lived there, so nothing
failed, and the glob could not say whether that was a decision or an oversight.

It was partly a decision. The routers under `apps/web/server` cannot be unit
tested: a test that imports the health router reaches `./trpc` -> `./context` ->
`./container`, and the composition root imports `server-only`, whose `exports`
field resolves to `index.js` outside the `react-server` condition -- a file whose
entire body is a `throw`. Verified in `node_modules/.pnpm/server-only@0.0.1`.
Files that reach no further than `@repo/contracts`, such as `domain-error.ts`,
are testable and simply have no test yet.

That made the `Date` -> ISO 8601 conversion in
`apps/web/server/routers/health.ts` untestable by construction. It is the only
logic in that router, the E2E suite asserts it in passing, and no unit test could
reach it.

## Decision

The unit surface is one glob: `{packages,apps}/**/*.test.ts`, node environment,
with `*.integration.test.ts` still excluded by name. `apps` is in it because
code that can be unit tested will live there -- `apps/web/server/env.ts` is the
next one -- not because the router became reachable.

There are no component tests. `.tsx` is deliberately absent from the include:
`packages/ui` is presentational, and the one client component,
`apps/web/components/refresh-button.tsx`, is covered by the E2E suite, so
nothing here needs jsdom or a testing library. A `*.test.tsx` file is
therefore collected by nothing and fails the gate below, which is how that
decision stops being a sentence in a config comment.

The `Date` -> ISO conversion moves out of the router into `toHealthStatus`, in
`packages/contracts/src/health.ts`, beside the schema whose shape it produces.
Its parameter is structural rather than imported, because `packages/contracts`
has zero internal dependencies and that property is what makes it safe for
everything else to depend on. The router calls it and does nothing else.

`tools/gates/test-collection-gate.test.ts` is the gate. It compares two lists:

- every `*.test.ts(x)` and `*.spec.ts(x)` in the working tree, from
  `git ls-files --cached --others --exclude-standard`, so an uncommitted test
  counts and everything gitignored does not;
- every file each root `vitest*.config.ts` reports collecting, from
  `vitest list --filesOnly --json`.

The configs are discovered rather than listed, so a new one is included by
existing. `fixtures/` and `e2e/` are excluded: they belong to the Stryker
fixture and to Playwright.

`tools/gates/test-collection.ts` holds the comparison as a pure function, and it
reports four things: a file no config collects, a config that collects nothing, a
file two configs both collect, and either list arriving empty -- which means the
scan broke rather than the repository being empty.

The gate is shown to fail on purpose, like every other one here, but with no
file in `fixtures/`: it writes an uncollected `*.test.tsx` where a component
test would go, asserts that exactly that file is reported, and deletes it again.
A fixture directory cannot do that job, because `fixtures/` is excluded from the
scan and the property under test is what the scan sees in the working tree.

Measured: `vitest list --filesOnly` does not run `globalSetup`. Asking the
integration project what it collects with `DOCKER_HOST` pointed at a dead port
returns the file list in about four seconds, so the gate needs no Docker.

## Consequences

The gate runs in `pnpm verify:gates`, so it is part of the `Gate liveness` job
and of `pnpm gates`. It spawns one `vitest list` per config, about four seconds
each, and does it twice: once for the comparison, once for the deliberate
breakage.

It reads the working tree, not the index, so a test file that is written but not
yet committed already has to be collected by something. That is the moment the
gate is worth failing at, and it costs a stray `scratch.test.ts` in a working
directory failing `pnpm gates`.

It also shells out to `git`, so it needs a git checkout rather than an unpacked
archive. CI checks out with git; there is no second consumer today.

Three limits, stated rather than discovered:

- It checks collection, not execution. A config that no script and no CI job
  runs still satisfies it, and so does a `package.json` script narrowed to run
  less than the config collects. What stands behind that is `.github/**` being
  an owned path: the job that runs a suite is reviewed.
- Configs are discovered at the repository root only. A per-package
  `vitest.config.ts` would go unseen and its tests would be reported as
  collected by nothing -- a false positive, but a loud one.
- `vitest.integration.config.ts` keeps the narrow `packages/<pkg>/src` glob,
  because adapters are the only thing it tests and they live nowhere else. An
  integration test written outside that shape is collected by nothing and fails
  this gate, which is the loud direction.

Stryker runs the unit config, so `packages/contracts` tests now execute in every
mutation run and kill no mutants, since `mutate` does not cover that package.
Measured at no visible cost: 55s and a score of 96.23 before and after. (ADR-0004
put the package into `mutate`, so those tests kill mutants from then on.)

A `*.test.tsx` file now fails CI rather than quietly not running. Wanting
component tests means changing this ADR, which is the intended cost.

`toHealthStatus` is unit tested, and nothing measures how good those tests are:
Stryker's `mutate` covers `packages/core/src/*/domain/**`, and
`packages/contracts` is not in it. Step 4 of the current plan decides whether it
joins. (ADR-0004 is that decision: it joined, as a whole package.)

`packages/contracts` gains `vitest` as a devDependency, which is three lines in
the lockfile and no new package in the store: it declares what it already uses,
the way `packages/core` does.

The `apps/` half of the include is exercised by nothing today, because no test
lives there yet. When the first one lands, this gate is what proves the glob
reached it.

## Rejected alternatives

**A second vitest project for `apps`.** Two includes to keep in step instead of
one, and the failure mode being fixed here is precisely an include that stops
matching. One glob has half as much to rot.

**Coverage with a threshold instead of a collection gate.** An uncollected file
scores zero and a global percentage absorbs it, so the signal is a number that
can be argued down rather than a named file. This repository already prefers the
mutation score over line coverage for the same reason.

**Re-implementing the include globs inside the gate.** The gate would then
compare vitest's globs against its own matcher, and agree with itself whenever
both are wrong. `vitest list` asks the tool that actually decides.

**A CLI entry point, like `tools/check-pr-isolation.ts`.** That check has no
local form because it reads a pull request. This one has every input locally and
`pnpm verify:gates` already runs the gates that are vitest suites, so a second
entry point would be one more thing to keep wired into the workflow.

**Leaving the mapping in the router and unit testing the router.** It cannot be
imported outside a React server runtime, and the way around that is to mock
`server-only` -- at which point the test asserts the mock, which the mutation
threshold rejects and `AGENTS.md` forbids.

**A `toWire` function in `packages/core/src/health/domain`.** Legal, since core
may import contracts. But it puts the definition of the wire form one package
away from the schema that states it, and no rule about health decides that JSON
has no date type. The conversion is a property of the contract.
