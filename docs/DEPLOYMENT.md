# Deployment

## Connecting Vercel

This is the one Phase 0 step that cannot be automated from the repo; it needs
access to the Vercel account.

1. Import the repository into Vercel.
2. Set the project **root directory** to `apps/web`.
3. Framework preset: Next.js. Leave build and install commands at their
   defaults -- Vercel detects pnpm workspaces from `pnpm-workspace.yaml`.
4. Set `DATABASE_URL` for Preview and Production. Use a separate database per
   environment; a preview deployment must never point at production data.
5. Confirm Git integration is on: pull request creates a Preview deployment,
   merge to `main` creates the Production (staging) deployment.

The E2E job in `.github/workflows/ci.yml` is triggered by the `deployment_status`
event that Vercel emits when a preview finishes building, and runs Playwright
against `environment_url`. Reading the event directly means no polling step and
no third-party action holding a token in this repository.

Until Vercel is connected, the `deployment_status` event never fires, so the E2E
job simply does not run. The other gates are unaffected.

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
| `DATABASE_URL` | Vercel Preview + Production, and local `.env` | Postgres connection string |
| `E2E_BASE_URL` | CI only, set by the E2E job  | Target for Playwright            |

Nothing reads `process.env` inside `packages/core` -- a lint rule forbids it.
Configuration enters through `apps/web/server/container.ts` and is passed down as
arguments. That is what keeps core testable and portable.

## AWS migration readiness

Three properties are maintained from day one, so a migration replaces `apps/`
and nothing else:

1. Domain logic is runtime-agnostic and pure; route handlers stay thin.
2. Postgres is used portably. No vendor-specific APIs.
3. Background work must not be built on serverless function timeouts. Queues,
   cron, and long-running jobs get a separate worker entry point from the start,
   so only the trigger mechanism changes.
