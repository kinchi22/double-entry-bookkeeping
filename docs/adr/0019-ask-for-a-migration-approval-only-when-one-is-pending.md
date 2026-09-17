# ADR-0019: Ask for a migration approval only when one is pending

**Status:** Accepted
**Date:** 2026-09-17

## Problem

`Apply migrations` runs on every push to `main`, in the `production-database`
environment, which requires the owner's approval (ADR-0009). ADR-0009 accepted
the cost: every push waits for an approval, whether or not it carries a
migration. Every merge since the last migration (#15) -- #16, #23 and #24 --
asked for one with nothing to apply, and approving them ran `drizzle-kit
migrate` for nothing.

The obvious filter, "did this push change `packages/db/drizzle/`", is wrong for
this workflow. `ci.yml` cancels a run in progress when a newer push arrives,
approval waits included (ADR-0009), and an approval can be rejected. In either
case the migration is still pending, and a filter that looks at one push would
never ask for it again.

## Decision

A job named `Pending migrations` runs on push to `main` before `Apply
migrations`. It holds no secret and names no environment, so it never waits.

- It reads the `production-database` deployments GitHub records for each run of
  `Apply migrations`, newest first, and takes the commit of the newest one whose
  latest status is `success`: the last commit Production was migrated at.
- It lists the files that differ between that commit and this one, from a
  checkout with full history.
- A migration is pending when any of them is under `packages/db/drizzle/`, the
  journal included.
- Every doubt resolves to pending: no successful deployment, a failed API call,
  a commit git cannot compare.

`Apply migrations` runs only when the result is not `false`. Its condition names
the results of `gates` and `integration` rather than relying on the implicit
success check, so a failed or skipped `Pending migrations`, whose output is
empty, still leads to the approval request.

The decision is `tools/find-pending-migrations.ts`: two pure functions and a CLI
that feeds them from `gh` and `git`. `tools/gates/pending-migrations-gate.test.ts`
breaks the functions with cancelled, rejected and waiting runs, and runs the CLI
against a stub `gh` and a git repository made for the test.

`Migrate preview` is unchanged: it needs no approval, and running it on every
push keeps it the canary that fails before Production is asked.

## Consequences

A push with no migration asks the owner for nothing. A push with one asks as
before, and so does every push after a migration whose approval was cancelled
or rejected, until it is applied.

The last applied commit is whatever GitHub recorded, and a run of `Apply
migrations` succeeds when `PRODUCTION_DATABASE_URL` is unset (ADR-0009). A run
like that counts as applied, and the next push does not ask. The same run
already reported success without migrating anything, so this adds no new way to
be wrong, but it does make that one last longer.

A migration applied outside the job, with `pnpm --filter @repo/db db:migrate`,
is still pending as far as this check knows, so the next push asks. Approving
then applies nothing, since drizzle-kit skips the migrations its journal table
already records.

The check costs a checkout with full history and one API call per deployment
back to the last success. Its token is limited to `contents: read` and
`deployments: read`.

Only the first 100 deployments are read. More than 100 runs cancelled or
rejected in a row would read as "none applied" and ask, which is the safe
direction.

## Rejected alternatives

**Filtering on this push's changes.** One line in `ci.yml` and no script. A
migration whose approval was cancelled by the next merge, or rejected, would
never be asked for again, and Production would stay behind its code until
someone re-ran the job by hand.

**A workflow of its own with a `paths` filter.** It cannot wait on this run's
`Gates` and `Integration`, and it has the same gap as filtering on one push.

**Asking the database what is applied.** Exact, and it needs the production
URL in a job that runs before anyone approves, which is what the environment
exists to prevent.

**A tag moved to the last migrated commit.** It needs write access from the
migrate job, and a movable tag is one more ref to protect.
