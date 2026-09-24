# ADR-0004: Make the mutation score the coverage floor

**Status:** Accepted
**Date:** 2026-09-13
**Amended:** 2026-09-24, PR #116

## Problem

There was no coverage gate in this repository, and the mutation gate was not one
either: `mutate` was `packages/core/src/*/domain/**`, which is what the bootstrap
brief asked for ("Stryker (domain layer only)"). Measured on `2c63ee5`: `Found 2
of 424 file(s) to be mutated`, 53 mutants, score 96.23.

Two files were measured. Everything else could have had no test at all and every
gate would still have been green:

- `packages/core/src/health/application/get-health.ts` -- the only use case.
- `packages/contracts/src/health.ts` -- unit tested since ADR-0003 and unmeasured,
  which that ADR recorded and left for this one to decide.
- `apps/web/server/domain-error.ts` -- the whole HTTP mapping, with no test.

The reason contracts was outside is recorded in the brief rather than in a
decision: the package held zod schemas and types, so there was no behaviour to
measure. ADR-0003 ended that by moving `toHealthStatus` into it, on the grounds
that what `checkedAt` has to be is a property of the contract. Once a package
holds behaviour, the premise of the exclusion is gone.

`test:unit` collects `{packages,apps}/**/*.test.ts` since ADR-0003, and no test
lived under `apps/` at all, so the `apps` half of that glob was exercised by
nothing.

## Decision

The mutation score is the coverage floor, and widening `mutate` is how a file is
required to be tested. A file nobody tests scores 0, and 0 on any file large
enough to matter takes the total under the break threshold of 90. There is no
line-coverage tool and no `@vitest/coverage-v8`.

`mutate` states a surface in patterns, not a list of files:

```
packages/core/src/*/{domain,application}/**/*.ts
packages/contracts/src/**/*.ts
apps/web/server/**/*.ts
!apps/web/server/{container,context,trpc,root-router}.ts
!apps/web/server/routers/**
!**/*.test.ts
```

A new feature's `domain/` and `application/`, a new file in `contracts`, and a
testable new file under `apps/web/server` are therefore measured the moment they
exist, with no edit to the config. A glob that has to be widened by hand is a
glob that silently stops covering things, which is the failure ADR-0003 exists
about.

`packages/contracts` joins whole, not file by file. Cherry-picking `health.ts`
would leave the same silent gap for the next contract that carries behaviour.

Every exclusion is a file no unit test can import, rather than a file whose tests
are missing: each reaches `apps/web/server/container.ts`, which imports
`server-only`, whose `exports` resolve outside the `react-server` condition to a
module whose entire body is a `throw`. So the answer to a broken threshold is a
test. Adding a name to that list is not available as a quiet answer: the config is
an owned path in `.github/CODEOWNERS`, so a pull request that edits it pulls the
owner in as reviewer, on a milestone branch too, where nothing else does.

What enforces that is the rulesets rather than `CODEOWNERS` on its own, which only
requests a reviewer: both set `require_code_owner_review` -- `main` alongside one
required approval, `milestone/**` alongside none. That is a repository setting, like
the required checks, so nothing in this repository tests it.

Ownership is cheap because the surface is patterns. A milestone that adds a
feature adds `core/src/x/{domain,application}` (matched), `contracts/src/x.ts`
(matched), `server/routers/x.ts` (already excluded by directory) and pages under
`app/**` (outside), and needs no edit here at all.

The config moves from `stryker.config.json` to `stryker.config.mjs`, because an
exclusion list whose entries are claims about `server-only` needs to carry that
reason beside it and JSON cannot hold a comment. It is `stryker.config.ts` now,
and carries no comment (ADR-0025). Nothing referenced the file by name;
`pnpm test:mutation` passes the path explicitly rather than relying on
discovery.

`apps/web/server/domain-error.test.ts` is the first unit test under `apps/`, so
it is also what proves ADR-0003's widened include reaches there. `apps/web`
declares `vitest` as a devDependency, the way `packages/contracts` and
`packages/core` already do: three lines in the lockfile and no new package in the
store.

Measured on this branch: 11 files mutated, 86 mutants, score **97.67**, against
two files, 53 mutants and 96.23. Stryker's `Found N of M` line is quoted above for
the baseline and not here, because `M` counts whatever sits in the working tree and
moves on its own.

One fact about the runner that shapes where a test has to live: Stryker sandboxes
the repository and symlinks `node_modules`, so a workspace import of
`@repo/contracts` resolves to the original, unmutated package. A mutant in
`packages/contracts/src` is therefore killable only from a test inside that
package, importing by relative path. Tests in `core` that exercise contracts code
prove nothing about it here, which is the correct shape anyway -- a package's own
tests are what measure it -- but it is why `result.ts` and `errors.ts` scored 0
while being executed by every other suite in the repository.

## Consequences

Four things are permanently outside every automated coverage gate, covered by the
E2E suite and by nothing else. Stated plainly, because this is the gap that the
widening does not close:

- `apps/web/server/routers/**`
- `apps/web/server/container.ts`, `context.ts`, `trpc.ts`, `root-router.ts`
- `apps/web/app/**`, including Server Actions, which reach the composition root
  the same way
- `packages/ui`, which is presentational, and `packages/db`, which is a schema

`tools/**` is outside too, and for a different reason: the gates' own tests run
under `vitest.gates.config.ts`, Stryker runs the unit config, so mutating
`tools/` would score 0 against tests that exist. The gates are tested and
unmeasured. ADR-0002 already records the related limit that `tools/` is unowned.

`packages/contracts` now costs a test per validation rule. A schema that tightens
something -- a `min`, an `enum` member, a `refine` -- has a mutant that only a
test parsing a rejected value can kill, so a rule nothing tests drags the score
instead of sitting there looking enforced. That is the intended cost.

Two mutants survive on purpose, both in `packages/core/src/health/domain/status.ts`
and both blanking a human-readable message inside a `domainError(...)`. Nothing in
this repository branches on message text -- the code is what a router maps -- so
killing them would mean asserting wording in a domain test and making it brittle
for no behaviour. The threshold has room for them at 97.67. If copy ever becomes
behaviour, which is what step 7's i18n catalogue would do, that changes.

An exclusion is still an escape hatch, and what closes it is a person rather than
a gate: nothing proves an excluded file is genuinely unimportable. The owner
reviews the list, and `fixtures/mutation/` proves only that the threshold itself
is alive.

One of the five is unimportable for a reason that could change without anyone
touching it. `trpc.ts` reaches the composition root through
`import { type AppContext } from './context'`, an inline type specifier that
`verbatimModuleSyntax` keeps as a side-effect import; turn that setting off and the
file becomes importable, which would make it excluded and testable -- the one state
this list should not contain.

The run is slower, by less than the surface grew: five times the files and 1.6
times the mutants, for about one and a half times the wall clock. Locally 1m23s to
1m43s across runs against 55s; the CI job went from 29s to 36s. The initial dry run
dominates, which is why 33 more mutants cost half a minute.

`stryker.config.ts` is typechecked by the root `tsconfig.json`, which includes
`*.config.ts`. It loses the `$schema` reference that gave the JSON file editor
validation.

## Rejected alternatives

**`@vitest/coverage-v8` with a threshold.** Strictly weaker in both directions. A
global percentage absorbs an untested file instead of naming it, and it rewards
executing code rather than asserting on it -- exactly the test that
`fixtures/mutation/subject.test.ts` is, which has full line coverage and kills no
mutant. Mutation score already refuses that test, so a second number would only
give an argument for lowering something.

**Naming `apps/web/server/domain-error.ts` in `mutate`.** The original plan for
this step. It measures the one file that needed it today and leaves the next
testable file under `apps/web/server` -- `env.ts`, next -- silently unmeasured.
That is the failure shape ADR-0003 was written about, one directory over.

**Mutating `adapters/**` or the routers anyway.** Stryker runs the unit config, so
neither is executed by any test it can see. Every mutant would survive, the score
would sit near zero, and the only way to green would be lowering the threshold --
which is the move this gate exists to prevent.

**Keeping `stryker.config.json` and putting the reasons in this ADR alone.** The
exclusion list would then be five bare paths in a file a reader cannot ask "why
is `trpc.ts` here" of. Every other configuration file in this repository carries
its reasoning inline, and the two failure modes `docs/ARCHITECTURE.md` names are
both "the config looks right and has stopped doing anything".

**A gate that proves each exclusion is genuinely unimportable**, by walking the
module graph for a transitive `server-only` import. It is the strongest option and
it was rejected on cost against frequency: the exclusion list moves at most once
per phase -- a new router, the common case, is already covered by directory -- and
ownership of the config buys the same protection for one line in `CODEOWNERS`. The
limit it leaves is recorded above rather than left implicit.

**Asserting the two surviving messages.** See the consequence above: it trades a
brittle test for a number that is already above threshold.
