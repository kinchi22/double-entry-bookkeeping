# Architecture

## Design principle

Verifiability is the architecture. Documentation and conventions do not constrain
output; failing tests and CI gates do. Every rule below is enforced by a gate
that exits non-zero, and every gate has a fixture in `fixtures/` proving it
actually fails. A rule that is only written here is not a rule.

That claim is itself gated. `tools/gates/rule-coverage-gate.test.ts` reads the
shipped ESLint and dependency-cruiser configuration and fails if a rule is turned
on without a fixture, so a new rule cannot arrive unverified. The escape hatch is
an explicit exemption in `tools/gates/fixture-map.ts` carrying a reason why a
fixture is impossible rather than merely absent; there are two today, both listed
in `fixtures/README.md`.

## Package layout

```
apps/web          Next.js. Composition only, no logic.
packages/contracts zod schemas and shared types. Zero internal dependencies.
packages/core     domain + application + ports + adapters, per feature.
packages/db       Drizzle schema and client.
packages/ui       design system, domain-agnostic.
packages/config    eslint / ts / tailwind / dependency-cruiser presets.
```

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
| IDs                  | uuid v7, branded types.                                                |
| Money                | Integer minor units, branded `Money`. No raw `number` arithmetic.      |
| Dates                | Store UTC, `timestamptz`. Convert only at display.                     |
| Transaction boundary | Owned by the use case. Repositories never begin a transaction.         |
| Authorization        | Checked at the use case entry point. Controllers pass the auth context.|
| Structure            | Feature-first: layers inside features, not features inside layers.     |
| Migrations           | Generated SQL committed with the schema change. Applied from CI.       |
| Dynamic imports      | Forbidden outside `apps/web/server/container.ts`.                      |
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
complexity at 4, so anything longer has to move into `core`.

## Human review budget

Reserved for: schema changes, auth and permission logic, money, data migrations,
and `apps/web/server/container.ts`. Everything else is gates plus line-level
review.
