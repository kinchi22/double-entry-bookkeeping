# ADR-0024: Promote a Production deployment only after its migration

**Status:** Accepted
**Date:** 2026-09-24

## Problem

ADR-0009 connected Vercel and the two Neon projects, and ADR-0013 kept every
migration out of the milestone that needs it. Together they made a criterion
that changes the schema cost two pull requests into `main`, two Production
deployments and two approvals, and fixed the schema before the code that
explains it was reviewed with it. A shape found wrong later cost a second,
additive migration.

The split existed for one reason. Vercel made a successful Production
deployment Current Production as soon as it was built, while `Apply migrations`
waited in the `production-database` environment for the owner. A milestone
carrying its migration would have had its behaviour receiving traffic against
a schema it needs and does not yet have.

The words matter here, because the old ones conflated two events:

- A **Production deployment** is an artifact Vercel built with the Production
  environment's configuration. It exists; it need not receive traffic.
- **Promotion** assigns the production domains to one.
- **Current Production** is the deployment receiving production traffic.

Vercel's Deployment Checks separate the first two: a Production deployment is
built, and stays unpromoted until every check the project requires has passed
on its commit. What remains true, and constrains any design:

- Vercel's Force Promote control cannot be removed by repository code. Anyone
  with the dashboard can promote past a failed check.
- Vercel sends a repository-dispatch event when a deployment is ready
  (`vercel.deployment.ready`) and when one is promoted
  (`vercel.deployment.promoted`), each carrying the commit's SHA, the
  environment and, for ready, the deployment's own URL.
- A Preview deployment builds without touching its database: the environment is
  validated at first use (ADR-0005). A Preview build that succeeds can still fail
  every request that needs a table its milestone adds.

The facts ADR-0009 measured still hold and still decide the rest of the
deployment:

- Supabase's pooler certificate chains to a private root that node-postgres
  cannot verify with `sslmode=require`; Neon's chains to ISRG Root X1.
- A Neon child branch shares its parent's data and role passwords unless branch
  protection, a paid feature, is on.
- Standard Protection puts every deployment URL behind a Vercel login, and the
  production domain too.
- Playwright's error text for a failed request lists the request's headers,
  and its HTML report keeps that text.
- Vercel enables Corepack only when the root `turbo` range starts at 2.1.3 or
  later; below that it installs its own pnpm 11.x.

## Decision

**A milestone carries its migration.** The schema change, its generated SQL,
the behaviour and the specs reach `main` in one merge. The Migration Task
follows the Specs Task onto the milestone, in a pull request the owner reviews
as code owner of `packages/db/drizzle/`, and blocks the Tasks that need the
schema. Migration-bearing milestones may run concurrently. When one reaches
`main`, every other milestone whose migration was generated from the older
journal merges `main` and regenerates its migration in a pull request of its
own onto the milestone, reviewed again, before its integration pull request.

**Promotion waits for the migration.** Vercel keeps building Production
deployments from its Git integration, and its Deployment Checks hold each one
unpromoted until three checks pass on its exact commit:

1. `Production ready`, one always-present job in `ci.yml`. It passes only when
   `Gates` and `Integration` succeeded, the shared Preview database was
   migrated, any pending Production migration was approved and applied, and
   Current Production passed smoke on the resulting schema. It tells an
   intentional no-migration skip apart from a skipped or failed prerequisite.
   `Apply migrations` is never the release signal itself.
2. `E2E build`, the whole suite against a build of the commit on its own
   migrated database (ADR-0006, ADR-0012).
3. `Candidate Production smoke`, a commit status published on the ready
   event's SHA after the `@smoke` specs pass against that deployment's own URL.

After Promotion the `@smoke` specs run once more, against the production
domain, and report. A failure there is an incident: nothing rolls back
automatically.

**Order.** Preview first, as a canary: a Production approval is requested only
after the Preview database migrated successfully. The Production migration
waits for the owner in `production-database`, which accepts only `main` and
alone holds `PRODUCTION_DATABASE_URL`. A missing Preview or Production database
URL fails the release; it is never a successful no-op. A commit with nothing
pending asks nobody.

**Migration state is its own record.** A successful `production-database`
deployment is the durable record of the last migrated commit, written when the
migration succeeds and before any compatibility or Promotion check runs, since
none of those can undo it. What is pending is recalculated from that record, and
any doubt counts as pending.

**Concurrency.** A started migration is never cancelled. Releases waiting
behind it are coalesced to the newest `main` commit, which recalculates what is
pending once the running release finishes; an older commit's Production
deployment is never promoted.

**Backwards compatibility.** Every migration works with Current Production,
because Current Production serves on the new schema between the migration and
Promotion. A destructive change is an expand, then a contract, across releases.

**Force Promote** is prohibited while a migration is pending or has failed. Its
one sanctioned use is an emergency roll-forward: the migration succeeded,
Current Production failed its smoke on the new schema, and the candidate passed
its own. The incompatible migration is then a defect.

**Preview is best effort.** Every Preview deployment uses the one shared Preview
Neon project, which is migrated from `main` alone. No Preview result gates
anything.

**Retained from ADR-0009:**

- *Databases.* Two Neon projects, production and preview: Postgres 18, AWS
  Singapore, with Vercel functions in `sin1`. The app connects through each
  project's pooled URL, migrations through the direct URL, and every URL
  carries `sslmode=verify-full`. Local development and the integration suite run
  `postgres:18-alpine`.
- *Names.* There is no staging. Production's data is disposable until the MVP
  ships.
- *Git integration.* One Vercel project is connected to the repository, and it
  builds a Preview for a pull request and a Production deployment for `main`.
  Nothing deploys from a CLI and no Vercel token is held.
- *Migrations.* Applied from CI, never from a Vercel build, and only after the
  owner approves in `production-database`.
- *Smoke.* Every smoke run uses the `@smoke`-tagged read-only specs, passes the
  Protection Bypass for Automation secret as `x-vercel-protection-bypass`, signs
  in as the Smoke User (ADR-0021), and uploads no report. Deployment Protection
  stays at Standard Protection.
- *pnpm.* Vercel installs with its built-in pnpm 11.x; Corepack is not used.

**Retained from ADR-0013:** the Preview database is migrated from `main`, in the
`preview-database` environment, which accepts only `main`, requires no
approval, and alone holds `PREVIEW_DATABASE_URL`.

## Consequences

- A schema-bearing criterion is one integration pull request, one Production
  deployment and one migration approval. Its schema is reviewed beside the code
  that explains it, and a wrong shape is corrected on the milestone before it is
  ever applied.
- Every commit to `main` now waits for the full release chain before it
  receives traffic, even with nothing to migrate: `Production ready` includes a
  smoke run, and `Candidate Production smoke` another.
- Current Production runs on the new schema until Promotion, and nothing but
  the owner's review of the migration keeps that safe. The smoke after
  migration detects an incompatibility; it cannot prevent one.
- A schema-bearing milestone's Preview deployments fail wherever they need the
  new schema, until it reaches `main`.
- Two concurrent migration-bearing milestones cost the later one a sync, a
  regenerated migration and a second owner review.
- The Deployment Checks are Vercel project settings. No gate in this repository
  sees them, and a check removed there lets Promotion run ahead of a migration
  again.
- Force Promote is a rule, not a control.
- A post-Promotion smoke failure leaves a failing deployment serving until the
  owner acts.
- The candidate smoke's commit status and the promoted run both depend on
  Vercel's repository-dispatch events being enabled. Without them the candidate
  status never appears, so Promotion waits rather than proceeds.
- The consequences ADR-0009 recorded for the retained parts stand: a smoke
  failure is read in the job log alone, one Vercel project per repository is
  assumed, Vercel's pnpm minor can differ from CI's, and a Postgres 17 volume
  needs `pnpm db:reset`.

## Rejected alternatives

**Land a migration before the milestone that needs it**, ADR-0013's rule. Two
Production deployments and two approvals per criterion, and the schema fixed
before its code is reviewed. It was the price of automatic Promotion, which is
gone.

**The milestone carries its migration, with automatic Promotion.** Behaviour
would receive traffic against a schema it needs before the owner approved it.

**Deploy Production from CI with a Vercel token, or promote every deployment by
hand.** A credential able to deploy Production in the repository, or a manual
step on every release including the ones with nothing to migrate.

**Make `Apply migrations` the Deployment Check.** It is skipped when nothing is
pending, and a skipped job looks like success to a required check, so a skip
caused by a failed prerequisite would read the same as an intentional one.

**Roll back automatically when post-Promotion smoke fails.** A transient
failure, or an expired Smoke User session, would change Production with nobody
deciding to.

**A Neon branch per milestone, or migrate the Preview database from milestone
branches.** New per-milestone infrastructure for a database no gate reads, or
unreviewed branches holding a credential and two milestones fighting over one
schema.

**Skip every Preview build that is not `main`.** Loses the Previews that do
work, which is most of them, to fix the few that cannot.

**A third-party Action to publish the Deployment Check status.** Executable code
holding the repository's token; `gh api` with `statuses: write` does the same.

**Apply migrations from the Vercel build**, rejected in ADR-0009 and still: a
build runs for every Preview, and no hook runs once per Production deployment.

**Supabase; one Neon project with a preview branch; migrations applied on merge
without approval; Deployment Protection off; a report uploaded after scrubbing;
Corepack; a staging environment.** Rejected in ADR-0009 for reasons that still
hold: an unverifiable certificate, Preview holding Production's passwords, the
one irreversible change left without its own review, public Previews, a secret
left in some encoding of the report, pnpm pinned through an experimental
download, and a paid plan protecting nothing.
