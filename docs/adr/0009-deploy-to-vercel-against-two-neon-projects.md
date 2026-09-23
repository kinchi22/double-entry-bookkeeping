# ADR-0009: Deploy to Vercel against two Neon projects

**Status:** Accepted
**Date:** 2026-09-15

## Problem

The last Phase 0 step connects Vercel: a pull request gets a Preview deployment,
a merge to `main` a Production one. That needs a database for each, a way to
apply migrations to Production's, and a smoke run that can reach what was
deployed. Measured while connecting it:

- Supabase's pooler certificate chains to a private root, `Supabase Root 2021 CA`
  (`openssl s_client -starttls postgres`: verify return code 19).
  `pg-connection-string` 2.14, under node-postgres 8.23, treats
  `sslmode=require` as full verification, so the connection fails, and the
  health probe reports that as `unreachable`, an answer the specs accept. Neon's
  certificate chains to ISRG Root X1.
- A Neon child branch starts with its parent's data and "the same Postgres roles
  and passwords as the parent branch" (Neon docs); new passwords per branch need
  branch protection, a paid feature.
- Vercel's Standard Protection puts a deployment's own URL, the
  `environment_url` its `deployment_status` event carries, behind a Vercel login:
  it answers 302 to Vercel SSO. The production domain answers 200.
- Vercel emits `deployment_status` for every deployment, previews included, on
  the deployed commit, and a workflow it triggers adds its jobs' checks to that
  commit. On `1452b6b`, two such runs of `ci.yml` added `Gates`, `Integration`,
  `Mutation testing`, `Gate liveness` and `Spec isolation`, all skipped by `if:`,
  beside the real ones. A job skipped by `if:` reports success to a required
  check.
- When a request fails, Playwright's error text lists the request's headers,
  and the HTML report keeps that text. Reproduced with a server that drops the
  connection: the bypass header's value was in `playwright-report/data/*.md`.
- Vercel enables Corepack only if the lower bound of the root `turbo` range is
  at least 2.1.3. `^2.0.0` is not, so it turns Corepack off and installs its own
  pnpm 11.x, the major taken from `packageManager`.

## Decision

**Databases.** Two Neon projects, production and preview: Postgres 18, AWS
Singapore, with Vercel functions in `sin1`. The app connects through each
project's pooled URL; `migrate` through production's direct URL. Every URL
carries `sslmode=verify-full`. Local development and the integration suite run
`postgres:18-alpine`.

**Names.** The deployment a merge to `main` produces is Production. There is no
staging. Production's data is disposable until the MVP ships and is wiped before
its first real use.

**Migrations.** `migrate` runs in the GitHub environment `production-database`,
which accepts only `main` and requires the owner's approval.
`PRODUCTION_DATABASE_URL` is a secret of that environment. A migration merges and
is applied before any code that needs it merges.

**Smoke run.** The `E2E` job lives in `.github/workflows/e2e-deployed.yml`,
triggered by `deployment_status` alone. It runs for a successful deployment whose
environment is named `Production`, and its concurrency group is keyed by the
deployment id. Deployment Protection stays on: the job passes a Protection Bypass
for Automation secret, which `playwright.config.ts` sends as
`x-vercel-protection-bypass`, and it uploads no report.

**pnpm.** Vercel installs with its built-in pnpm 11.x. Corepack is not used.

## Consequences

- A push to `main` waits for approval only while a migration is pending. A newer
  push cancels a run still waiting; the next approved run applies everything
  pending.
- New code reaches Production before its migration is approved. The
  migration-first rule is what keeps that safe, and no gate enforces it.
- A smoke failure is read in the job log, where GitHub masks the secret. There
  is no HTML report or trace to download.
- If Vercel renames the environment, the smoke run stops running instead of
  failing. It was never a merge gate, so nothing blocks on it.
- The smoke run's filter and concurrency group assume one Vercel project per
  repository. A second connected project reports on the same GitHub deployment
  id (measured on PR #12, where a second project's failed Preview build replaced
  the first's `Vercel` status), so its Production URL would pass the filter.
- Until the first smoke run after this lands, the bypass header is proven only
  against a local server and the unprotected production domain.
- Vercel's pnpm minor version can differ from the 11.8.0 CI runs.
- Nothing migrates the preview database. A preview that needs a migration gets
  it by hand.
- A local volume written by Postgres 17 does not start under 18 until
  `pnpm db:reset` recreates it.

## Rejected alternatives

**Supabase.** Verification fails as measured above. Making it pass means
committing Supabase's CA and handing it to the pool, or `sslmode=no-verify`,
which encrypts without checking who answers. Its free projects also pause after
a week without activity, and only two may be active.

**One Neon project with a preview branch.** Preview would hold production's
passwords, so code running in a preview could open production, and the two
would share one project's free quota.

**Migrations applied on merge without approval.** The pull request's approval
would be the only review of the one change a later fix cannot undo, which is why
`.github/CODEOWNERS` owns `packages/db/drizzle/`. A repository secret would also
be readable by every job.

**The smoke job in `ci.yml` behind `if:`.** Each Vercel deployment would add
skipped checks named like the required ones to the commit under review. ADR-0006
rejected an `if:`-scoped `E2E build` for the same failure.

**Deployment Protection off, or the smoke run aimed at the production domain.**
Off makes every preview public. The production domain serves whichever
deployment is current, not necessarily the one the event reports.

**Upload the report with tracing off, or scrub the secret first.** The header is
in the error text whether or not a trace is taken, and a scrub has to find every
copy in every encoding the report uses.

**Corepack, by raising the root `turbo` range to `^2.1.3`.** It would pin pnpm to
exactly 11.8.0, through a Node feature marked experimental that downloads the
package manager during the build.

**A staging environment separate from Production.** Vercel's custom environments
need a paid plan, and until the MVP there is nothing in Production a staging
would protect.
