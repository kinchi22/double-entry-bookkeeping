# Architecture

## Design principle

Verifiability is the architecture. Documentation and conventions do not constrain
output; failing tests and CI gates do. Every rule below is enforced by a gate
that exits non-zero, and every gate is shown to fail on purpose. A gate that
runs real tooling has a fixture in `fixtures/` that breaks it; a gate that is a
pure function takes the same deliberate breakages as inputs in its own test. The
split follows what can rot: a tool resolves paths and can silently stop
matching, a function over values cannot. A rule that is only written here is not
a rule.

That claim is itself gated. `tools/gates/rule-coverage-gate.test.ts` reads the
shipped ESLint and dependency-cruiser configuration and fails if a rule is turned
on without a fixture, so a new rule cannot arrive unverified. The escape hatch is
an explicit exemption in `tools/gates/fixture-map.ts` carrying a reason why a
fixture is impossible rather than merely absent; there are two today, both listed
in `fixtures/README.md`.

## ADRs

`docs/adr/` holds one ADR per decision: the problem, what was chosen, what it
costs, what was rejected. This file states the rule as it stands today; the ADR
states why it stands, and whether it is in force.

`Deferred` marks a decision taken and deliberately not built. It is not a rule,
so nothing enforces it, and it is not an open question either, so it is not for
deciding again. Adopting one edits that ADR in place.

`tools/gates/adr-gate.test.ts` checks the shape: numbering, the status
vocabulary, the required sections, a trigger on every deferred ADR, an adoption
line on every ADR that waited, and the status in the table below against the
status in the ADR itself. Decisions taken before ADR-0001 stay in this file and
in the commit that made them; ADR-0001 says why they were not backfilled.

| ADR | Status |
| --- | ------ |
| [ADR-0001: Record architecture decisions](adr/0001-record-architecture-decisions.md) | Accepted |
| [ADR-0002: Land the specs first, under human review](adr/0002-land-the-specs-first-under-human-review.md) | Accepted |
| [ADR-0003: Collect every test file, wherever it lives](adr/0003-collect-every-test-file.md) | Accepted |
| [ADR-0004: Make the mutation score the coverage floor](adr/0004-make-the-mutation-score-the-coverage-floor.md) | Accepted |
| [ADR-0005: Validate the environment once, at first use](adr/0005-validate-the-environment-once-at-first-use.md) | Accepted |
| [ADR-0006: Gate main on the specs, run against a build](adr/0006-gate-main-on-the-specs-run-against-a-build.md) | Accepted |
| [ADR-0007: Keep copy in one catalogue](adr/0007-keep-copy-in-one-catalogue.md) | Accepted |
| [ADR-0008: Localize without a locale in the URL](adr/0008-localize-without-a-locale-in-the-url.md) | Deferred |
| [ADR-0009: Deploy to Vercel against two Neon projects](adr/0009-deploy-to-vercel-against-two-neon-projects.md) | Accepted |
| [ADR-0010: Model a record as a balanced entry of lines](adr/0010-model-a-record-as-a-balanced-entry-of-lines.md) | Accepted |
| [ADR-0011: Make an aggregate write atomic](adr/0011-make-an-aggregate-write-atomic.md) | Accepted |
| [ADR-0012: Run the specs against a real database](adr/0012-run-the-specs-against-a-real-database.md) | Accepted |
| [ADR-0013: Land a migration before the milestone that needs it](adr/0013-land-a-migration-before-the-milestone-that-needs-it.md) | Accepted |
| [ADR-0014: Keep Production out of the write specs](adr/0014-keep-production-out-of-the-write-specs.md) | Accepted |
| [ADR-0015: Model accounts as data](adr/0015-model-accounts-as-data.md) | Deferred |
| [ADR-0016: Correct an entry by reversal](adr/0016-correct-an-entry-by-reversal.md) | Deferred |
| [ADR-0017: Authenticate before the MVP](adr/0017-authenticate-before-the-mvp.md) | Deferred |
| [ADR-0018: Log infrastructure failures through a port](adr/0018-log-infrastructure-failures-through-a-port.md) | Accepted |
| [ADR-0019: Ask for a migration approval only when one is pending](adr/0019-ask-for-a-migration-approval-only-when-one-is-pending.md) | Accepted |
| [ADR-0020: Keep `health.get` as the deployment's healthcheck](adr/0020-keep-health-get-as-the-healthcheck.md) | Accepted |

## Package layout

```
apps/web          Next.js. Composition only, no logic.
packages/contracts zod schemas and shared types. Zero internal dependencies.
packages/core     domain + application + ports + adapters, per feature.
packages/db       Drizzle schema and client.
packages/ui       design system, domain-agnostic.
packages/config    eslint / ts / tailwind / dependency-cruiser presets.
```

`packages/core/src/money/` is a shared kernel rather than a product feature: it
holds the vocabulary any feature that touches an amount depends on, so it has
`domain/` and nothing else. An amount has no ports, no adapters, and nothing to
orchestrate. It is the only directory under `core/src` that is allowed to be
shaped that way, and a second one needs a reason in review.

`packages/core/src/logging/` is the other module that is not a product feature:
how any adapter reports a failure. It has `domain/` (`describeError`, what of an
error may be logged) and `ports/` (`Logger`), and no adapter: the implementation
is pino, built in the composition root. ADR-0018 gives the reason it is shared.

`packages/infra` deliberately does not exist yet. Adapters live in
`core/src/<feature>/adapters/` and are promoted to their own package once there
are two or more external integrations.

## Allowed dependency matrix

Whitelist: anything not marked allowed is a violation.

| from -> to        | contracts | core | db  | ui  | apps/web |
| ----------------- | :-------: | :--: | :-: | :-: | :------: |
| **contracts**     |     -     |  x   |  x  |  x  |    x     |
| **core**          |     y     |  y   |  x  |  x  |    x     |
| **core/adapters** |     y     |  y   |  y  |  x  |    x     |
| **ui**            |     x     |  x   |  x  |  y  |    x     |
| **apps/web**      |     y     |  y   |  x  |  y  |    y     |

apps/web reaches core only through its public surface (`@repo/core`,
`@repo/core/server`, `@repo/core/<feature>`), never into a layer directly.

Inside apps/web, `messages/` imports nothing else in the repo, and only `app/`
and `components/` import it. That line is `eslint-plugin-boundaries` alone:
dependency-cruiser treats `apps/web` as one unit. ADR-0007.

### Layer rules inside `core`

- `domain/**` must not import `application`, `ports`, or `adapters`
- `application/**` must not import `adapters`; it depends on `ports`
- `domain`, `application`, and `ports` must not import `drizzle-orm`, `next`,
  `react`, `@repo/db`, a database driver, `fetch`, or `process.env`
- `packages/core/package.json` lists neither `next` nor `react`. The ability to
  break the rule is removed rather than policed.

Enforced by `eslint-plugin-boundaries` (import statements) and again by
`dependency-cruiser` (the resolved module graph, including type-only imports).
The overlap is intentional: the two tools fail differently.

## Two failure modes this configuration exists to prevent

**Dead rules.** An `eslint-plugin-boundaries` element pattern that matches
nothing does not fail loudly; it silently stops checking. Element patterns match
*folders*, and pnpm resolves workspace packages through a `node_modules`
symlink, so the element list in `packages/config/eslint/boundaries.mjs` names
both the real path and the linked one. `boundaries/no-unknown-files` is on so an
unclassified source file fails instead of escaping the matrix.

**Silently unsupported tooling.** TypeScript is pinned to `~6.0.x` because
`typescript-eslint@8` supports `<6.1.0`. On TypeScript 7 the parser degrades and
every type-aware lint rule stops running while the config still looks correct.
Raise the TypeScript major only together with `typescript-eslint`.

## Fixed decisions

| Item                 | Decision                                                              |
| -------------------- | --------------------------------------------------------------------- |
| Error model          | Domain returns `Result<T, DomainError>`. No throwing.                  |
| HTTP mapping         | Only in tRPC routers, via `apps/web/server/domain-error.ts`.           |
| IDs                  | uuid v7, branded per entity from `uuidV7Schema`. Generators are injected, never imported into a pure layer. |
| Money                | A branded integer in contracts, scale 0: no decimal places, no currency symbol, locale grouping at display only. Arithmetic only through `@repo/core/money`, which returns `Result`. A per-book scale is the additive path if a decimal currency ever appears. |
| Dates                | An instant is stored in UTC as `timestamptz` and converted only at display. A calendar day -- the day an entry is posted -- is a `date`: it holds no time, so there is nothing to convert. ADR-0010. |
| Transaction boundary | A repository method that writes one aggregate is atomic by itself and may open a transaction to be so. Any boundary wider than one aggregate is owned by the use case, and a repository never opens one. ADR-0011. |
| Authorization        | Checked at the use case entry point. Controllers pass the auth context.|
| Structure            | Feature-first: layers inside features, not features inside layers.     |
| Migrations           | Generated SQL committed with the schema change. Applied from CI, after the owner approves, and merged before the code that needs them. CI asks for that approval only when a file under `packages/db/drizzle/` changed since the last commit Production was migrated at (ADR-0019). A milestone never carries one: the schema reaches `main` in its own pull request first. ADR-0009, ADR-0013. |
| Dynamic imports      | Forbidden everywhere, the composition root included. ADR-0002.         |
| Client writes        | Server Actions in `apps/web/app/**/actions.ts`, invoking `createCaller`. |
| Wire types           | Contracts are JSON-safe. An instant crosses as an ISO 8601 string; `Date` exists only inside core, and the serializer that converts lives beside the schema. |
| Logging              | Adapters report an infrastructure failure through the `Logger` port, as an event name and fields, describing any error with `describeError`; a field's type admits no raw error or object. pino writes one JSON object per line to stderr, built in the composition root; core never imports it. A request that fails on the server is logged by `onRequestError` in `apps/web/instrumentation.ts`. ADR-0018. |
| Environment          | `DATABASE_URL` only, validated by `parseEnv` in `apps/web/server/env.ts` and read in `apps/web/server/container.ts` alone, at first use rather than at import. Missing or malformed fails the request; unreachable degrades to the probe's amber dot. ADR-0005. |
| Healthcheck          | `health.get` is the deployment's healthcheck, not a demonstration of the Phase 0 slice, and outlives the panel that renders it. Every external component the app depends on reports through it as a named component, and the smoke run asserts the strict answer: `healthy`, with `postgres` reachable. ADR-0020. |
| Barrels              | One `index.ts` per public surface. No barrels inside a package.        |
| User-facing copy     | In `apps/web/messages/en.ts`, a plain object read by import, grouped by the part of the UI that renders it. `repo/no-inline-copy` rejects copy written as a literal in `apps/web/app` or `apps/web/components`. ADR-0007. Localization is decided and not built: ADR-0008, Deferred. |

## Testing layers

| Layer                        | How it is tested                                      |
| ---------------------------- | ----------------------------------------------------- |
| `domain/**`                  | Unit tests, pure. Measured.                            |
| `application/**`             | Unit tests against stub ports, never spies. Measured.  |
| `ports/**`                   | Nothing. An interface has no behaviour to test.        |
| `adapters/**`                | `*.integration.test.ts` against a real Postgres. Unmeasured: the mutation runner does not run that suite. |
| `packages/contracts`         | Unit tests, pure. Measured since ADR-0004.             |
| `apps/web/server`            | The half a unit test can import -- `domain-error.ts`, `env.ts`, `logger.ts` and `request-error.ts` today -- unit tested and measured. |
| the composition root, `routers/**`, `app/**` | Playwright, against a production build in CI (`E2E build`), on a Postgres service container migrated before the suite. Nothing else reaches them. |

"Measured" means the mutation score, which is the only coverage floor here:
there is no line-coverage gate and no `@vitest/coverage-v8`. `stryker.config.mjs`
states the measured surface as patterns rather than a list, so a new file in a
measured directory is measured by existing. A file nobody tests scores 0, and the
break threshold of 90 is over the whole surface, so what fails is a named file
rather than a percentage. Measured today: 19 files, 322 mutants, score 99.38.

The exclusions in that config name files no unit test can import, not files whose
tests are missing: each reaches the composition root, and that imports
`server-only`. So the rows above that say Playwright are outside every automated
coverage gate, and `tools/**` is outside too, for a different reason -- its tests
run under `vitest.gates.config.ts` and the mutation runner runs the unit config.
ADR-0004 carries the reasoning, the numbers and the limits; the config is an owned
path below, so the exclusion list cannot grow without the owner seeing it.

Which files those suites run is gated too. The unit project collects
`{packages,apps}/**/*.test.ts` as one glob, and
`tools/gates/test-collection-gate.test.ts` compares every test file in the
working tree against what each root `vitest*.config.ts` reports collecting, so a
test file that no project collects fails CI instead of being invisible. What it
does not check is that a config is wired into a script or a CI job; ADR-0003
records that limit. There are no component tests: `.tsx` is not in the include,
which means a `*.test.tsx` is collected by nothing and fails that gate.

Adapters are integration-tested with testcontainers rather than against the
docker-compose database. A shared development database makes the gate
conditional on a developer having remembered `pnpm db:up`, and a conditional
gate is the failure mode this repository exists to avoid. The container URL
travels as `TEST_DATABASE_URL`, never `DATABASE_URL`, so a test cannot reach a
real database by accident.

## Route handler rule

tRPC procedures and Server Actions do three things: parse input, invoke a use
case, map the response. A lint rule caps procedure bodies at 20 lines and
complexity at 4, so anything longer has to move into `core`. The cap covers
`server/routers/**`, `app/api/**` and `app/**/actions.ts`, because a rule that
applied to one write path and not the other would just tell logic where to
accumulate.

## How the browser writes

Writes go through Server Actions, not through a tRPC client. The action calls
`createCaller`, so it goes through the same router the HTTP endpoint uses and
the same use case underneath; only the transport differs. `/api/trpc` stays for
clients outside this app.

The reason is reversibility rather than preference. A tRPC client can be added
later on top of routers that already exist, and it costs a provider and a
hydration boundary to remove again. Until something needs a client-side cache or
a second consumer, the actions path adds no dependency and no wiring that gates
cannot see.

`useFormStatus` and `useActionState` cover pending state and form errors, so a
client component that needs them needs nothing installed.

## Dates on the wire

`checkedAt` is a `Date` in `core` and an ISO 8601 string in `packages/contracts`,
and `toHealthStatus` converts between them, beside the schema whose shape it
produces. A contract describes what crosses a wire, JSON has no date type, and a
`Date` in a contract types the value as something the transport cannot carry:
over HTTP the client is handed a string while the type promises an object, and
nothing notices until the first `.getTime()`.

The conversion sat inline in the router until ADR-0003. Nothing in
`apps/web/server` that reaches the composition root can be unit tested -- it
imports `server-only`, which throws outside a React server runtime -- so the one
piece of logic in the router was reachable by the E2E suite and by nothing else.

The alternative -- a superjson transformer that reconstructs `Date` on the other
side -- was rejected because it makes the contract type mean "correct for a
JavaScript client that shares this transformer" rather than "correct".

## Human review surface

Every pull request into `main` needs one approval. An agent cannot land anything
there alone -- a document, a gate, a dependency bump included -- and the place it
works unattended is a milestone branch.

Four paths are owned on top of that:

| Path                     | Why                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `e2e/**`                 | The requirements, as executable specs. An agent that may edit them can make a failing requirement pass by rewriting it. |
| `packages/db/drizzle/**` | An applied migration is the one change a later fix cannot undo.                                                        |
| `.github/**`             | The gates, and the ownership list itself: how everything else on this page stops being a promise.                      |
| `stryker.config.mjs`     | The coverage floor. One `!` line takes a file out of the only gate that requires it to be tested, and on a milestone branch nothing else would review that. ADR-0004. |

`.github/CODEOWNERS` declares exactly these four: this table and that file are
the same list said twice, and `tools/gates/review-surface-gate.test.ts` fails
when they stop agreeing. They disagreed until ADR-0002, and what fell through
the gap was `e2e/`.

Ownership does two different jobs depending on where a pull request lands. Into
`main`, where an approval is required anyway, it decides *whose*: a change under
an owned path needs the code owner's. Into `milestone/**`, where no approval is
required, it is the entire rule -- a spec change is reviewed, and everything else
merges unattended, behind the gates.

Schema changes, auth and permission logic, money and `apps/web/server/container.ts`
were on this list and came off it. ADR-0002 says why, and ends the lint exemption
the composition root carried on the strength of being read by a person.

## How a criterion ships

A specification lands before the behaviour it describes. A spec can only be
green after the behaviour exists, so it needs somewhere to be red in the
meantime, and that is a milestone branch: one branch per acceptance criterion,
branched from `main`, named `milestone/<name>`.

| Pull request                | Approved by | E2E    | Isolation |
| --------------------------- | ----------- | ------ | --------- |
| specs -> `milestone/x`      | the owner, as code owner | not run (the specs would fail by design) | e2e only |
| feature -> `milestone/x`    | nobody      | not run (the specs would fail until the behaviour lands) | no specs |
| `main` -> `milestone/x`     | the owner if the sync carries an owned path | - | exempt |
| `milestone/x` -> `main`     | the owner, like every pull request into `main` | green, required | exempt |

A feature branch merges with no approval at all: what it may do was settled when
the spec was approved, and the one thing it must not do -- edit the spec -- is
checked rather than reviewed. A spec that turns out to be wrong is corrected in
its own pull request onto the milestone, reviewed like the first one.

Nothing forces product code through this route. A pull request straight into
`main` is allowed and sometimes right -- a spec correction, a tooling change, a
fix with no criterion behind it. What stops a behaviour from arriving with no
specification is the approval on that pull request, not a rule about paths.

A migration is the one thing a milestone does not carry. Vercel deploys a merge
to `main` while `Apply migrations` is still waiting for the owner, so a schema
change goes to `main` in a pull request of its own, is approved and applied
there, and the milestone that needs it merges afterwards. ADR-0013.

`tools/check-pr-isolation.ts` decides the isolation column from the pull
request's file list and the two branch names, and the `Spec isolation` job fails
when both sides moved. It reads a pull request, so it has no local equivalent
and `pnpm gates` does not run it.

The E2E column is the `E2E build` workflow: the suite against a production build
of the pull request, run on every pull request into `main` and on `main` itself,
and on nothing aimed at a milestone. The job brings a `postgres:18-alpine`
service of its own and migrates it first, so a spec that writes is judged
against the schema its own commit carries; the deployed smoke run in
`E2E deployed` is not a required check and runs the `@smoke`-tagged reads alone.
ADR-0012, ADR-0014.

Required checks belong to a ruleset, and there are two: `main`, which requires
one approval, a code owner's where one applies, and six checks -- `Gates`,
`Integration`, `Mutation testing`, `Gate liveness`, `Spec isolation` and
`E2E build`; and `milestone/**`, which requires the first five and no approval.
That is how the suite is required on the trunk alone: it is a line in the first
of them and not in the second. ADR-0006.

Every required check, in both rulesets, is accepted from GitHub Actions only.
With "any source", GitHub's documentation says anyone with write access to the
repository -- the machine account included -- can set a check's state without
the job running. What the source does not stop is a pull request adding a workflow of
its own with a job of the same name; that is a change under `.github/`, so it
needs the owner. Rulesets are repository settings rather than files, so no gate
here checks them.

A green suite does not prove a spec asserts anything, so `Gate liveness`, which
runs on every pull request, runs the specs against an empty page and fails
unless each one fails on a line of its own. A spec that asserts nothing is
caught on the pull request that lands it on the milestone.

This is what "one PR per acceptance criterion" in `CLAUDE.md` now means: one
milestone per criterion, and as many feature pull requests underneath it as the
work takes.
