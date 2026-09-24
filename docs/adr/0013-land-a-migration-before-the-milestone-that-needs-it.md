# ADR-0013: Land a migration before the milestone that needs it

**Status:** Superseded by ADR-0024
**Date:** 2026-09-16

## Problem

Two accepted rules meet for the first time in Phase 1, which introduces the first
table.

ADR-0009 and `docs/DEPLOYMENT.md`: a migration merges, and is approved and
applied, before any code that needs it merges. Vercel deploys a merge to `main`
immediately, while `Apply migrations` waits in the `production-database`
environment for the owner, so code that runs ahead of its migration is code
running against a schema that does not have its table yet.

ADR-0002: a milestone branch carries an acceptance criterion's specs and its
behaviour, and reaches `main` in one merge. If that merge carries the migration
too, the behaviour is deployed before the migration is approved, every time.

Separately, nothing migrates the preview database (`docs/DEPLOYMENT.md`). While
the schema was empty that cost nothing. The first table makes every preview of a
pull request whose code reads it a broken deployment until someone migrates by
hand.

## Decision

**A milestone never carries a migration.** The schema change and its generated
SQL go to `main` in their own pull request, before the milestone that needs them
merges. The owner approves that pull request and then approves `Apply
migrations` for its push. Behaviour merges afterwards, so it never reaches
Production ahead of its schema.

**The preview database is migrated from `main`.** A `Migrate preview` job in
`ci.yml` runs on push to `main`, after `gates` and `integration`, in a new
GitHub environment `preview-database` that accepts only `main` and requires no
approval. Its secret `PREVIEW_DATABASE_URL` is the preview Neon project's direct
URL. It runs the same `pnpm --filter @repo/db db:migrate`.

## Consequences

The schema is fixed before the behaviour that uses it is written. A shape that
turns out wrong costs a second, additive migration rather than an edit.

A criterion that changes the schema now takes two pull requests into `main` and
two approvals, and the schema one is reviewed without the code that explains it.
The pull request body carries that explanation.

The preview database is migrated for what is on `main` and nothing else, so a
pull request whose own migration has not merged still has a broken preview. That
is the migration-first rule again rather than a new limitation, and with the
split above it means the milestone's previews are already on the right schema.

Preview is migrated without an approval, ahead of Production, which makes it a
canary: a migration that fails there has failed before the owner is asked to
apply it to Production. Between the two, the two databases are one migration
apart by design.

`PREVIEW_DATABASE_URL` is a secret of an environment restricted to `main`, so no
pull request job can read it. What could still reach it is a change to `ci.yml`
or to a package script that the job runs -- `.github/` is owned, package scripts
are not -- and what it would leak is a disposable database.

## Rejected alternatives

**The milestone carries the migration.** One pull request, and the behaviour is
live against a schema it needs before the owner has approved it. The smoke run
fires on the deployment, before the approval, so it would be red for a reason
that is not a defect.

**The milestone merges into `main` twice**, schema first. `main` would carry half
a criterion, and the branch would have to survive a merge it is not finished
with.

**Apply migrations from the Vercel build.** Rejected in ADR-0009: a build runs
for every preview, and there is no hook that runs once per production deploy.

**Migrate preview on every pull request.** Unreviewed code would hold the
credential, and two branches with different migrations would fight over one
database.

**A Neon branch per preview, through the Neon-Vercel integration.** A third
party in the deployment path, and dashboard setup, for a database no gate reads.

**Leave preview unmigrated and fix it by hand.** That is the status quo, and it
makes every preview of a schema change a manual step nobody is reminded of.
