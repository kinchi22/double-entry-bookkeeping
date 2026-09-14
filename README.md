# Double Entry Bookkeeping

Full-stack web app for double-entry bookkeeping.

**Status: Phase 0 complete.** The pipeline is built and every gate is verified
alive. No product feature code exists yet beyond the `health` slice, which is a
pipeline probe rather than a feature and should not be deleted.

## Requirements

- Node 24+
- pnpm 11 (`corepack enable`)
- Docker with Compose v2+ (local Postgres only; not needed to build or test)

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm db:up                     # local Postgres in Docker, waits until healthy
pnpm build
pnpm dev                       # http://localhost:3000
```

The health panel should report `postgres: reachable`.

The app also renders without a *reachable* database: the probe reports
`postgres` as unreachable and the status degrades rather than erroring. That is
deliberate, so a preview deployment whose database is down still passes E2E.

`DATABASE_URL` itself is not optional. It is validated on the first request, in
`apps/web/server/env.ts`, and a missing or malformed one fails that request
instead of degrading -- no probe can tell an unset variable from an outage, so
the two are separated here. ADR-0005.

### Migrations

```bash
pnpm --filter @repo/db db:generate   # schema change -> new migration
pnpm --filter @repo/db db:migrate    # apply to the database in DATABASE_URL
pnpm db:drift                        # fails if the schema has no matching migration
```

Generated SQL is committed in the same PR as the schema change that caused it.
`pnpm db:drift` regenerates into a scratch copy and fails if that would produce
anything new, so a schema edit cannot reach main without its migration. Every
integration run applies the committed migrations to its container with the same
command a deployment uses, so a migration that will not apply fails in CI rather
than during a deploy.

`packages/db/drizzle/` is currently just an empty journal. Phase 1 adds the
first migration alongside the acceptance criterion that justifies the table.

### Local database

```bash
pnpm db:up      # start, wait for healthy
pnpm db:down    # stop, keep data
pnpm db:reset   # stop, DESTROY the volume, start again
```

It listens on host port **5433**, not 5432, so it does not collide with another
project's Postgres. Data lives in a named Docker volume, so `db:down` keeps it
and only `db:reset` throws it away.

`.env` is the single source of configuration: `docker compose` interpolates it
when starting the container, and `pnpm dev` / `pnpm --filter @repo/db db:*` load
it through Node's built-in `--env-file-if-exists`. No dotenv dependency.
It is gitignored; `.env.example` holds the placeholders.

## How the app is wired

A page is a React Server Component that calls a tRPC procedure in-process
through `createCaller`, with no HTTP hop. Writes go through Server Actions in
`app/**/actions.ts`, which call the same procedures and then invalidate what
they made stale. `/api/trpc` exists for clients outside this app; nothing in
`apps/web` uses it.

Contracts are JSON-safe: an instant crosses as an ISO 8601 string and becomes a
`Date` only inside `core`. See "Dates on the wire" in `docs/ARCHITECTURE.md`.

## Gates

Run in this order; any failure blocks a merge.

| # | Command                      | What it enforces                                      |
| - | ---------------------------- | ----------------------------------------------------- |
| 1 | `pnpm typecheck`             | TypeScript strict; `any` forbidden; no deep imports    |
| 2 | `pnpm lint`                  | Boundaries matrix, layer purity, no-throw, ASCII-only  |
| 3 | `pnpm dep-cruise`            | Cycles, orphans, layer violations in the module graph  |
| 3b| `pnpm db:drift`              | Schema changed without a migration                     |
| 3c| `pnpm db:check`              | Migration journal is consistent                        |
| 4 | `pnpm test:unit`             | Vitest over `packages` and `apps`, no IO               |
| 4b| `pnpm test:integration`      | Adapters against a real Postgres (Docker required)     |
| 5 | `pnpm test:mutation`         | Stryker over domain, application, contracts and the testable half of `apps/web/server`; break threshold 90. The only coverage gate. |
| 6 | `pnpm build`                 | Next build, including the `server-only` RSC boundary   |
| 7 | `pnpm test:e2e`              | Playwright against a production build; in CI, `E2E build` on every pull request into `main` |
| 8 | `pnpm jscpd`                 | Duplication threshold                                  |

`pnpm gates` runs everything except E2E, and except `pnpm verify:gates:e2e`,
which runs the specs against an empty page and fails unless every one of them
fails. Both need a browser (`pnpm exec playwright install chromium`); CI runs
them in `E2E build` and `Gate liveness`. ADR-0006.

CI runs one more check that has no local form. `Spec isolation` fails a pull
request that changes `e2e/` and anything else in the same change: the specs are
the requirements, they land before the behaviour, and editing one beside the code
it judges is how a failing requirement gets rewritten into a passing one. It
needs a pull request to read, so `pnpm gates` cannot run it.

Every pull request into `main` needs an approval, whatever it changes. Work
proceeds unattended on a milestone branch instead, one per acceptance criterion:
the specs land on `milestone/<name>` first and the owner reviews them, feature
branches merge into it unreviewed, and it goes to `main` when the suite is
green. See "How a criterion ships" in `docs/ARCHITECTURE.md`, and ADR-0002.

### Unit tests

```bash
pnpm test:unit    # no Docker, no network
```

One project collects `{packages,apps}/**/*.test.ts`. A test sits beside the code
it covers, and `*.integration.test.ts` is excluded by name.

There are no component tests, so nothing here needs jsdom or a testing library:
`packages/ui` is presentational and the one client component is covered by the
E2E suite. A `*.test.tsx` file is therefore collected by no project, and
`pnpm verify:gates` fails it rather than letting it sit there never running --
which is the same check that catches a test file any other glob has stopped
matching. See ADR-0003.

`apps/web/server` is a special case: the composition root imports `server-only`,
which throws outside a React server runtime, so nothing that imports a router or
the container can be unit tested. Logic that needs a unit test goes somewhere
that has one.

### Integration tests

Anything named `*.integration.test.ts` under `packages/*/src/**` runs against a
throwaway Postgres that `tools/integration/postgres-container.ts` starts with
testcontainers, on the same `postgres:17-alpine` image docker-compose uses.

```bash
pnpm test:integration    # needs a running Docker daemon
```

The container is started by the suite rather than reused from `pnpm db:up`, so
the gate never depends on a developer having remembered to start the local
database, and a test can never point at a real one: the connection string
arrives as `TEST_DATABASE_URL` and nothing falls back to `DATABASE_URL`.

Repository and adapter tests belong here, not in `test:unit`. A mocked database
client only proves the adapter calls the methods it calls.

### Gate liveness

A rule that is written but not running is worse than no rule, because it buys
false confidence. `fixtures/` contains a deliberate violation of every rule, and
these commands assert each one still fails:

```bash
pnpm verify:gates            # lint, typecheck, dep-cruise, supply chain, and the test surface
pnpm verify:gates:build      # server-only, via a real next build
pnpm verify:gates:mutation   # Stryker threshold, via a mock-only test
pnpm verify:gates:migration  # migration drift, via an unmigrated schema change
```

They run in CI on every PR. See `fixtures/README.md`.

## Supply chain

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days): pnpm refuses to
install any package version published less than a week ago. Most malicious
publishes are caught and unpublished well inside that window, so the cooling-off
period turns them into a resolution that never happens.

Practical consequences:

- `pnpm add <pkg>@latest` resolves to the newest version that is already 7 days
  old. Exact pins on a fresh release fail to install; use a range instead and let
  the lockfile record the resolution.
- `pnpm install` reports things like `eslint 10.8.1 (10.9.0 is available)`. That
  gap is the policy working, not a stale lockfile.
- Postinstall scripts are denied by default. `allowBuilds` in
  `pnpm-workspace.yaml` lists the exceptions, keyed `name@version`, so a new
  version must be re-approved rather than inheriting trust. `onlyBuiltDependencies`
  and `ignoredBuiltDependencies` are the pnpm 10 spellings and pnpm 11 reads
  neither.
- To ship a same-day security patch, add the package to
  `minimumReleaseAgeExclude` and say why in the commit message. Keep the list
  empty otherwise.

CI installs with `--frozen-lockfile`, so the code that runs there is exactly the
code reviewed in the lockfile diff.

## Documentation

- `docs/ARCHITECTURE.md` -- dependency matrix, layer rules, fixed decisions
- `docs/GLOSSARY.md` -- one canonical name per concept
- `fixtures/README.md` -- which fixture proves which gate
- `CLAUDE.md` -- working agreement for AI agents

## Remaining setup (needs a human)

Vercel is not connected yet. See "Connecting Vercel" in `docs/DEPLOYMENT.md`.
