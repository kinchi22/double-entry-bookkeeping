# ADR-0020: Keep `health.get` as the deployment's healthcheck

**Status:** Accepted
**Date:** 2026-09-18

## Problem

`E2E deployed` smoke-runs the `@smoke` specs against each successful Production
deployment (ADR-0009, ADR-0014). Nothing in that run asserts that the production
database answers. Both health specs accept either answer on purpose:
`reachable|unreachable` on the panel, `healthy|degraded` over the tRPC endpoint.

That was right in Phase 0, when the suite ran against preview deployments whose
database might legitimately be absent. It is no longer: ADR-0006 moved the merge
gate to a build inside CI, and ADR-0012 gave that build its own Postgres, so the
only place a suite meets an unreachable database now is a deployment where the
database really is unreachable.

So `docs/DEPLOYMENT.md` told the reader to open the production domain after a
`DATABASE_URL` change and look at the health panel by hand. The panel is a
Phase 0 artifact and will be removed; an instruction that reads it stops working
then, and a check nobody runs proves nothing in the meantime.

The entries page covers some of this already -- rendering the list queries
`entries`, which ADR-0014 records -- but only as a side effect. Its spec asserts
that the form and the section render, so an error fallback that kept the form on
screen would leave it green with the database down, and ADR-0017 would put the
page behind a login.

## Decision

`health.get` is the deployment's healthcheck rather than a demonstration of the
Phase 0 slice. It outlives the health panel: when the panel is removed, the
procedure and the `@smoke` spec that calls it stay.

That spec asserts the strict answer -- HTTP 200, `status: 'healthy'`, and a
`postgres` component with `reachable: true`. A degraded deployment fails the
smoke run.

Every external component the app comes to depend on reports through the same
procedure, as one more named component, so a single call answers whether this
deployment can serve.

The panel's own spec keeps accepting either answer for as long as the panel
exists. That the page renders on a degraded deployment is a different claim, and
ADR-0005 requires it.

## Consequences

A green `E2E` now means the production database answered `select 1` at that
moment. The manual instruction in `docs/DEPLOYMENT.md` goes away.

The smoke run goes red when production's database is briefly unreachable, even
though nothing about the commit is wrong. It names no required check and blocks
no merge (ADR-0009), so the cost is a rerun and a red mark in the history. That
is the point of asserting it: a database that is down is what this run is for.

The probe issues `select 1`, so the assertion says nothing about migrations. A
deployment smoke-run while `Apply migrations` waits for approval still reports
healthy, which is what ADR-0013's ordering relies on.

`health.get` stays public and unauthenticated. It carries component names and
booleans, never a connection string or an error message; why a probe failed is
logged on the server instead (ADR-0018). When ADR-0017 is adopted, the procedure
has to stay reachable signed out, or the smoke run needs a session of its own.

A component added to the report tightens the assertion without editing the spec:
`healthy` requires every component reachable. A component whose own dependency
is flaky therefore makes the smoke run flaky, which is a reason to probe only
what the app cannot serve without.

Nothing polls the endpoint today. Keeping its shape stable is what lets a
heartbeat -- a scheduled caller outside the deployment -- read the same answer
later without a new surface.

## Rejected alternatives

**Assert `postgres: reachable` on the health panel.** It is the artifact being
removed, so the assertion would have to move again. A rendered dot also cannot
say which component failed without reading the panel's markup, which the
endpoint gives as data.

**Rely on the entries page spec.** It reaches the database only as a side effect
of rendering a list. The failure it would miss is exactly the one worth
catching: a page that still renders its form while the query behind it fails.
ADR-0017 would also take the page behind a login, and the smoke specs stay
read-only and signed out.

**Answer 503 when degraded.** That is the usual shape for a load balancer, and
the same endpoint is what the panel reads: a non-200 would turn the page's own
read into an error path for a deployment that renders fine. The spec asserts the
body instead, which carries more than a status code can. A poller outside the
app can read the body too.

**Probe the database from the workflow instead.** The job would need a
production connection string, which ADR-0014 keeps out of CI on purpose: it
holds a deployment bypass secret and nothing else.
