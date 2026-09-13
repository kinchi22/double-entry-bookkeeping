# ADR-0005: Validate the environment once, at first use

**Status:** Accepted
**Date:** 2026-09-13

## Problem

`getContainer` read configuration like this:

```ts
createContainer({ databaseUrl: process.env['DATABASE_URL'] ?? '' })
```

An unset variable became an empty string, the empty string reached the driver,
the driver failed to connect, and the health probe reported `postgres` as
unreachable. A deployment that was never configured and a database that is down
produced the same amber dot -- so the first would be diagnosed as the second,
against a database that is fine.

The obvious fix, validating at module scope, does not work here. Measured on
Next 16.3.1, in this repository:

- `next build` loads `apps/web/server/container.ts` while collecting page data
  for `apps/web/app/api/trpc/[trpc]/route.ts`. The `Gates` job builds with no
  `DATABASE_URL`, so a throw during that import fails CI on a change that is
  correct.
- With validation inside `getContainer()` instead, the same build passes with
  the variable unset, and `/` stays dynamic (`f`) rather than prerendered, so
  nothing calls the container at build time.
- Then, at runtime against that build, with the variable absent: HTTP 500 on the
  first request, logging `DATABASE_URL is not set. It must be a postgres:// or
  postgresql:// connection string with a host.` Set to the empty string, the same
  500 and the other message, `DATABASE_URL is not a postgres:// ...`.
- With `postgres://ci:ci@127.0.0.1:5433/ci`, a syntactically valid URL pointing
  at nothing: HTTP 200, probe reports unreachable. The amber dot survives.

## Decision

`apps/web/server/env.ts` exports a pure `parseEnv(record)`. It takes the record
rather than reading `process.env`, so it can be tested against a table of
malformed inputs and so that importing it has no effect.

It validates `DATABASE_URL` and nothing else, because nothing else is read at
runtime by application code. `TEST_DATABASE_URL` belongs to the integration
harness, `PRODUCTION_DATABASE_URL` to a CI job, and `NEXT_DIST_DIR` to the build
config; a schema field for a variable no code reads is speculative.

Valid means: parses as a URL, scheme `postgres:` or `postgresql:`, and a
non-empty host. That rejects an absent variable, an empty or whitespace one, a
bare `host:port`, another tool's scheme, and `postgres:///ledger`. It does not
reject a URL pointing at the wrong database, or one nothing is listening on --
those are not distinguishable here, and the second is what the probe is for.

`parseEnv` throws, where the domain returns a `Result`. The error model in
`docs/ARCHITECTURE.md` governs a failure some caller decides about. There is no
such caller: an environment this app cannot run in has no recovery, and a
`Result` would be unwrapped and thrown one line later.

Neither message quotes the offending value. A connection string carries a
password and this error reaches a build log and a server log.

`getContainer()` calls it, and nothing calls it at module scope. `no-restricted-properties`
now forbids `process.env` across `apps/web/server`, `apps/web/app` and
`apps/web/components`, with `container.ts` the single exemption, so a second
reader that skipped validation is a lint failure rather than a review catch.

## Consequences

The build is the gate on the laziness. Moving the call to module scope fails the
`Gates` job, which builds with no `DATABASE_URL` -- so the one property this ADR
cannot state in a unit test is enforced by a job that already exists, for its own
reasons. If that job ever gains a `DATABASE_URL`, this protection is gone
silently.

Validation happens on the first request, not at deploy. A deployment missing the
variable goes green in Vercel and fails when somebody visits it. Nothing in this
repository runs once per deploy -- `docs/DEPLOYMENT.md` records the same gap for
migrations -- so this is the earliest point available, not the ideal one.

Local development without a `.env` now fails outright instead of rendering an
amber dot. That is the intended trade, and it is a worse first run: the fix is
`cp .env.example .env`, which `README.md` already instructs.

The E2E job in step 6 must supply a syntactically valid, deliberately dead URL
rather than nothing. `postgres://ci:ci@127.0.0.1:5433/ci` is asserted by name in
`apps/web/server/env.test.ts`, so a stricter rule added later breaks that test
rather than that job.

`env.ts` is the first file to land inside the `apps/web/server/**/*.ts` mutate
pattern that ADR-0004 widened, with no configuration change. It arrived already
required to be tested, by both the collection gate and the mutation threshold,
and that was not a formality: the threshold rejected two versions of this file
before this one. It found the untestable `join` above, and then found that a
suite asserting only `/DATABASE_URL/` cannot tell the two rejection messages
apart, so deleting the `undefined` check survived. Both are fixed in what landed.

`README.md` and `docs/DEPLOYMENT.md` claimed the app renders without a database.
Both now say without a *reachable* one, and say that the variable is required.

## Rejected alternatives

**Validate at module scope**, at the top of `container.ts` or in a module
imported for its side effect. Fails `next build` at "Collecting page data" with
no `DATABASE_URL`, measured above. This is the alternative that looks right and
is not.

**Keep `?? ''` and let the probe report it.** This is the defect: a probe cannot
tell an unset variable from an outage, and reports the wrong one.

**Return `Result<Env, DomainError>`.** Consistent with the domain, useless here.
There is no caller to decide, so every call site would unwrap and throw.

**Accept any non-empty string.** Accepts a password pasted into the wrong field,
or a `psql` command line. Each then reports as unreachable, which is exactly the
confusion being removed.

**State the schema in `zod`**, the way contracts state a wire type. Written that
way first, and reverted on a measurement: `z.object({ DATABASE_URL: ... })` can
only ever report one issue, so the line that joins the issues into a message has
no input that distinguishes it, and it survived mutation as
`join(' ')` -> `join('')`. One variable is an `undefined` check and a predicate.
`zod` earns its place where input arrives in many shapes from a caller this code
does not control; the environment is one string this repository names itself.
The cost is that a second variable is two more lines rather than one more field.

**Validate at deploy time**, in a CI step or a startup hook. Vercel offers no
hook that runs once per deployment -- the same fact that keeps migrations in a
GitHub job. A CI step would validate CI's environment, not production's.

**A library** (`@t3-oss/env-nextjs`, `envsafe`). A new dependency for one
predicate and one message, against the no-new-dependencies rule, and it would own
the error text this ADR is specific about.
