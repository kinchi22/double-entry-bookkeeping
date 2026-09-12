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
| [ADR-0002: Reserve human review for the specs and the applied migrations](adr/0002-reserve-human-review-for-specs-and-migrations.md) | Accepted |

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
| Money                | Integer minor units, branded `Money` in contracts. Arithmetic only through `@repo/core/money`, which returns `Result`. |
| Dates                | Store UTC, `timestamptz`. Convert only at display.                     |
| Transaction boundary | Owned by the use case. Repositories never begin a transaction.         |
| Authorization        | Checked at the use case entry point. Controllers pass the auth context.|
| Structure            | Feature-first: layers inside features, not features inside layers.     |
| Migrations           | Generated SQL committed with the schema change. Applied from CI.       |
| Dynamic imports      | Forbidden everywhere, the composition root included. ADR-0002.         |
| Client writes        | Server Actions in `apps/web/app/**/actions.ts`, invoking `createCaller`. |
| Wire types           | Contracts are JSON-safe. An instant crosses as an ISO 8601 string; `Date` exists only inside core. |
| Barrels              | One `index.ts` per public surface. No barrels inside a package.        |

## Testing layers

| Layer                        | How it is tested                                      |
| ---------------------------- | ----------------------------------------------------- |
| `domain/**`                  | Unit tests, pure. Mutation threshold 90.               |
| `application/**`             | Unit tests against stub ports, never spies.            |
| `adapters/**`                | `*.integration.test.ts` against a real Postgres.       |
| `apps/web`                   | Playwright, against a deployed preview.                |

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
and the router converts between them. A contract describes what crosses a wire,
JSON has no date type, and a `Date` in a contract types the value as something
the transport cannot carry: over HTTP the client is handed a string while the
type promises an object, and nothing notices until the first `.getTime()`.

The alternative -- a superjson transformer that reconstructs `Date` on the other
side -- was rejected because it makes the contract type mean "correct for a
JavaScript client that shares this transformer" rather than "correct".

## Human review surface

Reserved for three paths, and nothing else:

| Path                     | Why                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `e2e/**`                 | The requirements, as executable specs. An agent that may edit them can make a failing requirement pass by rewriting it. |
| `packages/db/drizzle/**` | An applied migration is the one change a later fix cannot undo.                                                        |
| `.github/**`             | The gates, and the ownership list itself: how everything else on this page stops being a promise.                      |

`.github/CODEOWNERS` declares exactly these three: this table and that file are
the same list said twice, and `tools/gates/review-surface-gate.test.ts` fails
when they stop agreeing. They disagreed until ADR-0002, and what fell through
the gap was `e2e/`. Everything else in the repository is written and reviewed by
agents, behind the gates.

A pull request changes `e2e/**` or it changes the rest of the repository, never
both. `tools/check-pr-isolation.ts` decides that from the pull request's file
list and the `Spec isolation` job fails when both sides moved. That is the part
of "one PR per acceptance criterion" in `CLAUDE.md` a check can decide: it keeps
a spec away from the code the spec judges, and says nothing about how much else
a pull request does. The job reads the pull request, so it has no local
equivalent and `pnpm gates` does not run it.

Schema changes, auth and permission logic, money and `apps/web/server/container.ts`
were on this list and came off it. ADR-0002 says why, and ends the lint exemption
the composition root carried on the strength of being read by a person.
