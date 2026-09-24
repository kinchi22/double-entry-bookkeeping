# ADR-0012: Run the specs against a real database

**Status:** Accepted
**Date:** 2026-09-16
**Amended:** 2026-09-24, PR #PRNUM

## Problem

`E2E build` is the merge gate (ADR-0006). It builds with no `DATABASE_URL` and
runs the suite with a deliberately dead one,
`postgres://ci:ci@127.0.0.1:5433/ci`, asserted by name in
`apps/web/server/env.test.ts`. That was enough while every spec was a read of the
health panel, which accepts `reachable` or `unreachable` on purpose.

The first criterion of Phase 1 creates an entry and then reads it back. Against a
dead URL it cannot pass, so the gate that decides whether a milestone may reach
`main` would be judging the absence of a database rather than the behaviour.

Two facts from ADR-0005 and ADR-0006 bound what may change:

- What proves the environment is validated lazily is the `Gates` job building
  with no `DATABASE_URL` at all. It is not the dead URL, which is set on one step
  of a different workflow.
- What the dead URL does prove is the degraded render: the page answers with the
  database unreachable, rather than failing the request.

## Decision

`E2E build` gets a database.

- A `postgres:18-alpine` service container on the job, matching
  `docker-compose.yml` and the Neon projects.
- A step that runs `pnpm --filter @repo/db db:migrate` against it, before the
  suite, so the specs run on the schema this commit carries.
- Its URL as `DATABASE_URL` on the `test:e2e` step and nowhere wider. The build
  step keeps none, exactly as it does today, and `ci.yml` is untouched.

The dead URL leaves that workflow. `apps/web/server/env.test.ts` keeps the case
-- a URL pointing at nothing is still a valid connection string, which is what
that test asserts -- and loses the comment claiming a CI job depends on it.

## Consequences

CI no longer renders the page with the database unreachable. The health spec
still accepts either answer, so nothing fails, and nothing exercises the amber
path end to end either; what covers it is the probe's own integration test and
its unit tests. That is a real reduction, and it is the price of a merge gate
that can judge a write.

The job grows by the container's startup and one migrate step. The first run
measures both, and the number goes in the pull request.

Postgres 18 is now named in three places -- `docker-compose.yml`, this workflow,
and each Neon project -- and nothing checks that they agree. A mismatch surfaces
as a migration that passes CI and fails on Neon.

`Gate liveness` is unaffected: it runs against an empty page, not a database.

One database is shared by every spec in the run, which Playwright runs in
parallel, and by every attempt of a spec, since a retry writes again. So a spec
that writes finds what it wrote by a value no other run can have written -- a
memo carrying a fresh UUID, a User signed in under a fresh identifier -- never
by counting rows or by position in a list. Where order is the subject, the spec
reads position only among the rows it wrote itself, after asserting how many of
them there are. A spec that writes is never tagged `@smoke`: the smoke runs are
reads against deployed databases.

## Rejected alternatives

**Two runs, one dead and one live.** It keeps the degraded render in CI, and
doubles a job that already builds the app.

**testcontainers from a Playwright `globalSetup`.** The `Integration` job uses
testcontainers for the adapters, so the machinery exists. Here the URL has to
reach the `next start` the Playwright config spawns, which means mutating the
environment from a setup file and hoping the order holds. A service container is
declared, started before the job, and visible in the log.

**Keep the dead URL and let the create specs skip in CI.** A spec that does not
run is not a gate, and `Gate liveness` reports a skipped spec as a failure.

**Point the job at the Neon preview database.** A merge gate writing to a shared
remote database, from every pull request at once.
