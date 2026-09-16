# ADR-0014: Keep Production out of the write specs

**Status:** Accepted
**Date:** 2026-09-16

## Problem

The `E2E` job in `.github/workflows/e2e-deployed.yml` smoke-runs the whole
Playwright suite against each successful Production deployment (ADR-0009). Every
spec it has run so far is a read.

Phase 1 adds specs that create entries. Run against Production they write rows
into the deployment that becomes the owner's real books once the MVP ships, and
the job has no way to clean up: it holds a deployment bypass secret, not a
database credential, and giving it one would put the production connection
string in a second place for the sake of test bookkeeping.

The timing is wrong as well. The job is triggered by `deployment_status`, which
Vercel sends when the deployment succeeds. `Apply migrations` is waiting for the
owner's approval at that moment, so a spec that needs a table added by that same
push fails until a person clicks. ADR-0013 keeps schema and behaviour in separate
merges, which fixes the ordering, but a smoke run that writes would still be
writing.

## Decision

The smoke run is an allowlist. A spec that may run against Production carries
`{ tag: '@smoke' }`, and `e2e-deployed.yml` runs `pnpm test:e2e --grep @smoke`.

Tagged: the three health specs, and the entries page render. Untagged, and
therefore run only by `E2E build` against the disposable CI database: everything
that writes.

A new spec is not smoke-run unless someone tags it.

## Consequences

The smoke run asserts less than the merge gate does, on purpose. What it still
proves is what no other job can: the deployed page renders, the procedure
answers over HTTP, and -- because rendering the entries page queries
`entries` -- that the production database carries the migration.

The tag is a claim a person makes, and no gate checks it. An untagged write spec
is merely not smoke-run; a write spec tagged by mistake writes to Production.
Review of `e2e/` is where that is caught.

`--grep` exits non-zero when it matches nothing, so the tags have to land before
the workflow starts filtering on them. The pull request order in ADR-0013's
sequence puts the `e2e/`-only tagging change first.

Playwright 1.62 appends a tag to the test title, so `--grep @smoke` matches on
the title and needs no other configuration.

## Rejected alternatives

**Tag the writers and invert the filter** (`--grep-invert @writes`). Every new
spec is smoke-run by default, so the failure mode of forgetting a tag is a write
to Production instead of a spec that runs one place fewer.

**Run everything and mark the test data**, cleaning it up before the MVP. It
works only if someone remembers, and until then the owner's public URL lists rows
written by CI.

**Drop the smoke run.** It is the only thing that exercises the real deployment
against the real database. Losing it to avoid writes is losing the check to avoid
its cost.

**Give the smoke job a production credential to delete what it wrote.** A second
holder of the production connection string, and a delete path built for tests
before the product has one.
