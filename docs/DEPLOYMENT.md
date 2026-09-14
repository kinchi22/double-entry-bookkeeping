# Deployment

## Connecting Vercel

This is the one Phase 0 step that cannot be automated from the repo; it needs
access to the Vercel account.

1. Import the repository into Vercel.
2. Set the project **root directory** to `apps/web`.
3. Framework preset: Next.js. Leave build and install commands at their
   defaults -- Vercel detects pnpm workspaces from `pnpm-workspace.yaml`.
4. Set `DATABASE_URL` for Preview and Production. Use a separate database per
   environment; a preview deployment must never point at production data. It is
   required, not optional: a deployment without it answers its first request
   with a 500 rather than rendering a degraded page. ADR-0005.
5. Confirm Git integration is on: pull request creates a Preview deployment,
   merge to `main` creates the Production (staging) deployment.

The specs' merge check does not involve Vercel: `E2E build`, in
`.github/workflows/e2e-build.yml`, runs them against a production build inside
CI. ADR-0006.

The `E2E` job in `.github/workflows/ci.yml` is a smoke run of what was deployed.
It is triggered by the `deployment_status` event that Vercel emits when a preview
finishes building, and runs Playwright against `environment_url`. Reading the
event directly means no polling step and no third-party action holding a token
in this repository. Once Vercel is connected, narrow it to production
deployments.

Until Vercel is connected, the `deployment_status` event never fires, so the
`E2E` job simply does not run. The other gates are unaffected.

## Migrations

Migrations are applied by the `migrate` job in `.github/workflows/ci.yml`, on
push to `main`, after the gates and integration jobs pass. They are deliberately
not applied from the Vercel build: a build runs for every preview and must never
touch the production database, and Vercel offers no hook that runs exactly once
per production deploy.

To turn the job on, add a repository secret `PRODUCTION_DATABASE_URL` pointing
at the production database. Until it exists the step reports that it is unset
and succeeds, so the pipeline is green before the database is provisioned. A
protected GitHub environment on that job is worth adding at the same time, so
applying a migration requires an approval.

Because Vercel deploys on merge independently of this job, the two can land in
either order. Migrations must therefore be backwards compatible with the
currently deployed code: add columns and tables first, remove them in a later
release once nothing reads them. That is the one deployment rule this repository
cannot enforce with a gate.

Preview deployments share whatever database `DATABASE_URL` names in the Vercel
Preview environment. Point it at a preview database, never at production, and
apply migrations to it manually or from a branch job if a preview needs them.

## Local development database

`docker-compose.yml` at the repo root runs Postgres 17 for local work only. It
is not part of any deployment; Vercel gets its `DATABASE_URL` from the
dashboard, not from this file.

```bash
cp .env.example .env
pnpm db:up      # start, wait for healthy
pnpm db:down    # stop, keep data
pnpm db:reset   # stop, DESTROY the volume, start again
```

Three decisions worth knowing:

1. **Host port 5433.** The default 5432 is frequently already held by another
   project's container. Override with `POSTGRES_PORT` in `.env`, and change
   `DATABASE_URL` to match.
2. **A single root `.env`.** Compose reads it natively for `${...}`
   interpolation; the pnpm scripts load it with Node's built-in
   `--env-file-if-exists`, which is why no `dotenv` dependency was added.
   Because `--env-file` is rejected inside `NODE_OPTIONS`, the scripts invoke
   the real JS entrypoints (`node_modules/turbo/bin/turbo`,
   `node_modules/drizzle-kit/bin.cjs`) instead of the `.bin` shell shims.
3. **`DATABASE_URL` is declared on the `dev` task in `turbo.json`.** Turborepo
   runs tasks in strict env mode, so an undeclared variable is invisible to
   `next dev` even when it is present in the parent shell. A future task that
   needs the database must declare it too.

The container is stock `postgres:17-alpine` with no extensions, matching the
portability rule below: the same migrations run here, on Neon, or on RDS.

## Environment variables

| Name           | Where                        | Purpose                          |
| -------------- | ---------------------------- | -------------------------------- |
| `DATABASE_URL` | Vercel Preview + Production, and local `.env`; in CI, the `test:e2e` step of `E2E build`, deliberately dead | Postgres connection string. Required; must be `postgres://` or `postgresql://` with a host |
| `E2E_BASE_URL` | The `E2E` job, and `pnpm verify:gates:e2e` | Target for Playwright; unset, it starts `next start` |

Nothing reads `process.env` inside `packages/core` -- a lint rule forbids it.
Configuration enters through `apps/web/server/container.ts`, which validates it
through `apps/web/server/env.ts` and passes it down as arguments. That is what
keeps core testable and portable.

## AWS migration readiness

Three properties are maintained from day one, so a migration replaces `apps/`
and nothing else:

1. Domain logic is runtime-agnostic and pure; route handlers stay thin.
2. Postgres is used portably. No vendor-specific APIs.
3. Background work must not be built on serverless function timeouts. Queues,
   cron, and long-running jobs get a separate worker entry point from the start,
   so only the trigger mechanism changes.
