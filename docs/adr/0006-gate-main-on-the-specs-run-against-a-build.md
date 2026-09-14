# ADR-0006: Gate main on the specs, run against a build

**Status:** Accepted
**Date:** 2026-09-14

## Problem

ADR-0002 decided that a milestone reaches `main` only with every spec green,
and that the E2E suite is a required check there. Nothing ran the suite on a
pull request. The only job that ran it, `E2E`, was driven by the
`deployment_status` event Vercel sends when a preview finishes building, Vercel
is not connected, and so the job was skipped on every run. "Green, required" in
`docs/ARCHITECTURE.md` was a decision with no check behind it, and the file said
so.

Waiting for Vercel would not have fixed that. A check that only appears once a
third party finishes a deployment is not red when the deployment fails to
happen. It is missing, and a required check that is missing leaves the pull
request waiting, with nothing to say why.

A suite that runs is not enough either, because a green suite never proves a
spec asserts anything. Measured on Playwright 1.62 in this repository, against a
server that answers an empty 200 at `/` and 404 everywhere else:

- The three specs in `e2e/health.spec.ts` all fail, in 36 seconds. The re-check
  spec waits out the 30-second test timeout for an element that is not there.
- A planted spec that only calls `page.goto('/')` passes against that empty
  page, as it would against the app.
- With no browser installed, all three specs fail as well, in 5 seconds. Two of
  them never reach a line of the spec: they fail in `browserType.launch`. So
  "every spec failed" alone passes a run in which nothing was asserted.

What separates the real failures from the broken run is where the error points.
In the report, a failure on the spec's own assertion carries an error located in
`e2e/`; the timeout carries one unlocated error and one on the spec line that was
waiting. A launch failure carries only unlocated errors.

Two facts from ADR-0005 bound the job. The app answers 500 without a
`DATABASE_URL`, so the job has to supply one, and `postgres://ci:ci@127.0.0.1:5433/ci`
is asserted by name in `apps/web/server/env.test.ts` for that purpose. And the
`Gates` job builds with no `DATABASE_URL` at all, which is the only thing that
enforces validating the environment at first use rather than at import.

`apps/web/next-env.d.ts` was tracked. `next dev` and `next build` rewrite it with
different contents, so the tree was dirty or clean depending on which ran last.
Measured here: `tsc -p apps/web/tsconfig.json` passes with that file and
`.next/types` both absent, which is the state of a fresh checkout.

## Decision

**`E2E build` is the merge gate.** A job in `.github/workflows/ci.yml` that runs
on a pull request into `main` and on push to `main`: install, install chromium,
`pnpm build`, then `pnpm test:e2e`. `playwright.config.ts` already starts
`next start` when `E2E_BASE_URL` is unset, so no server step is added. The job
depends on no deployment.

- `DATABASE_URL` is set to the dead URL above on the `test:e2e` step and nowhere
  wider. The build step has none, like `Gates`, and a workflow-level value is
  what this rules out, because it would reach `Gates`.
- It does not run on a pull request into a milestone. A feature branch is red
  there by design until its behaviour lands, and ADR-0002 says the suite must not
  block it.
- It is required by the `main` ruleset alone. That is a repository setting, not
  a file.

**`E2E` stays, as a smoke run of what was deployed.** It is not a merge gate. Once
Vercel is connected it is narrowed to production deployments.

**E2E liveness runs in `Gate liveness`.** `tools/verify-e2e-gate.ts`, as
`pnpm verify:gates:e2e`, starts a server in its own process that answers an
empty 200 at `/` and 404 elsewhere, and runs Playwright against it with
`--retries=0 --forbid-only --reporter=json`. It fails unless:

- Playwright reported no error outside a spec;
- at least one spec ran;
- every test failed, so none passed, passed on a retry, or was skipped;
- every attempt of every test carries an error located under the spec directory;
- the empty page answered at least one request.

The decision is `findLivenessProblems`, a function over the JSON report, tested
with deliberate breakages as inputs in `tools/gates/e2e-liveness-gate.test.ts`.
`Gate liveness` is required by both rulesets and runs on every pull request, so a
spec that asserts nothing is caught on the pull request that lands it on a
milestone, while the owner is reviewing it.

**Neither `test:e2e` nor `verify:gates:e2e` is in `pnpm gates`.** Both need a
browser, and CI is already the stronger claim (ADR-0002).

**`apps/web/next-env.d.ts` is untracked and ignored.**

## Consequences

Measured locally: `pnpm build` 70 seconds with no turbo cache, `pnpm test:e2e`
20 seconds with `CI=true`, three passed and none retried. CI timings do not
exist yet. Chromium is installed twice for a pull request into `main`, once per
job, uncached. `Gate liveness` grows by a chromium install and about 36 seconds,
and every new spec that waits for something an empty page lacks adds up to its
own timeout to that.

The gate blocks nothing until `E2E build` is added to the `main` ruleset's
required checks, and only the owner can add it. Until then the job reports and
`docs/ARCHITECTURE.md` still cannot call the suite required.

A milestone's specs are not run by any job while it is a milestone, so ADR-0002's
"red specs as a progress bar" is read by running the suite locally or by opening
the pull request into `main`, not from a check on the milestone.

`E2E build` keeps the config's two retries in CI, so a flaky spec can pass the
gate on its second attempt. Liveness runs with none, but it tests that a spec
can fail, not that it fails consistently.

Liveness proves each spec fails against an empty page. It does not prove a spec
asserts the right thing, and it would fail a correct spec whose requirement an
empty page happens to meet -- that an unknown path answers 404, for instance.
There is no exemption for that; one would be a change to this script, and a
decision to take when such a spec exists.

The located-error rule separates "failed on its own line" from "never started".
It does not separate an assertion from a network error thrown by the spec's own
`page.goto`. The request count covers the case where nothing reached the empty
page at all, not a run where only some specs did.

The script's command half -- the server, the Playwright process, the exit code --
has no unit test. `Gate liveness` running it is its only exercise, and `tools/**`
is outside the mutation threshold (ADR-0004). It was checked by hand before it
landed: exit 0 against the real suite, exit 1 naming two specs with no browser,
exit 1 naming a planted spec that only opens the page. Thirteen hand-made
mutants of `findLivenessProblems` were each killed by its test file.

The script lives in `tools/`, which no one owns (ADR-0002), so it can be weakened
in a pull request onto a milestone that needs no approval. The step that runs it
is in `.github/`, which is owned.

A fresh clone has no `next-env.d.ts` until the first `next dev` or `next build`.
`typecheck` passes without it; an editor may lack Next's global types until then.

## Rejected alternatives

**Make the `deployment_status` job the gate.** It has never run, and when it does
it depends on a third party deploying: a deployment that never happens leaves a
required check missing rather than failed.

**A step inside `Gates`.** `Gates` runs on pull requests into a milestone, where
the specs are red by design, and it builds with no `DATABASE_URL`. Running the
suite there blocks the feature branches ADR-0002 says it must not, and supplying
the variable there removes the only check that validation is lazy.

**Run `E2E build` on every pull request and require it only on `main`.** On a
milestone it is red on every feature pull request until the last one, and a
check that is allowed to be red is a check nobody reads (ADR-0002).

**A separate workflow file triggered by `pull_request: branches: [main]`.** The
same jobs with the install boilerplate repeated, and the gates split across two
files. `Spec isolation` and `Apply migrations` are already scoped by `if:` in
`ci.yml`.

**Liveness inside `E2E build`.** It reuses that job's chromium, but it would run
only into `main`, so a spec that asserts nothing would sit on a milestone, with
feature work built against it, until the milestone was finished.

**"Every spec failed" as the whole liveness rule.** The run with no browser
passes it.

**Liveness in `pnpm gates`.** Every other `verify:gates:*` script is there, but
this one needs a browser installed and about 36 seconds, and `test:e2e`, the
suite it checks, is outside `pnpm gates` already.

**Keep `next-env.d.ts` tracked.** It changes whenever the other of `next dev` and
`next build` last ran, and nothing needs it committed.
