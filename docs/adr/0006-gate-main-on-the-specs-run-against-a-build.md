# ADR-0006: Gate main on the specs, run against a build

**Status:** Accepted
**Date:** 2026-09-14
**Amended:** 2026-09-22, PR #77
**Amended:** 2026-09-24, PR #PRNUM

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

## Decision

**`E2E build` is the merge gate.** It is the one job in
`.github/workflows/e2e-build.yml`, a workflow triggered by `pull_request` with
`branches: [main]` and by push to `main` and to `milestone/**`: install, install
chromium, `pnpm build`, then `pnpm test:e2e`. `playwright.config.ts` already
starts `next start` when `E2E_BASE_URL` is unset, so no server step is added.
The job depends on no deployment.

- `DATABASE_URL` is set to the dead URL above on the `test:e2e` step and nowhere
  wider. The build step has none, like `Gates`. A job- or workflow-level value
  would reach that build, and in `ci.yml`'s `env:` it would reach `Gates`.
- It does not run on a pull request into a milestone. A feature branch is red
  there by design until its behaviour lands, and ADR-0002 says the suite must not
  block it. The branch filter is on the workflow's trigger, not an `if:` on a job;
  the rejected alternatives say why.
- The push to `milestone/**` is not a gate. #71 decided that trigger after this
  ADR and PR #73 added it, so the milestone is judged by its own specs as each
  Task merges. It is in no ruleset and blocks no merge; the Consequences say
  what reading it is for.
- It is required by the `main` ruleset alone. That is a repository setting, not
  a file.

**`E2E` stays, as a smoke run of what was deployed.** It is not a merge gate. Once
Vercel is connected it is narrowed to production deployments. (Step 8 narrowed
it and moved it to its own workflow, `e2e-deployed.yml`, in ADR-0009.)

**E2E liveness runs in `Gate liveness`.** `tools/verify-e2e-liveness.ts`, as
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

## Consequences

Measured on the first CI run of this change: in `E2E build`, the chromium
install took 24 seconds, `pnpm build` 10 and `pnpm test:e2e` 4, three passed and
none retried; in `Gate liveness`, the chromium install took 22 seconds and the
liveness run 32. Locally the same build takes 70 seconds and the liveness run 36.
The build in `E2E build` had the same turbo hash as the one in `Gates`, which is
the evidence that no `DATABASE_URL` reached it. Chromium is installed twice for a
pull request into `main`, once per job, uncached, and every new spec that waits
for something an empty page lacks adds up to its own timeout to the liveness
run.

The gate is a repository setting as much as a file. `E2E build` blocked nothing
until the owner added it to the `main` ruleset's required checks, which was done
by hand after this change merged, on 2026-09-14. At the same time every required
check in that ruleset was restricted to GitHub Actions as its source, as the
`milestone` ruleset's already were: with "any source", GitHub's documentation
says anyone with write access, the machine account included, can set a check's
state without the job running.
No gate reads a ruleset, so either setting can be undone without a diff.

ADR-0002's "red specs as a progress bar" is read from the push run on the
milestone branch, which #71 decided and PR #73 carried into the workflow's
trigger list, its header and `docs/ARCHITECTURE.md` in one commit. That run is
advisory: it is in no ruleset, it blocks no merge, and it is read by the driver,
at a named step in `/implement-issue`'s loop, after each Task merges. It has to
be read rather than enforced, because no gate can tell a spec that is still
waiting for its Task from one that regressed. A pull request onto a milestone
runs nothing, so the suite before a merge is still read by running it locally.

`E2E build` keeps the config's two retries in CI, so a flaky spec can pass the
gate on its second attempt. Liveness runs with none, but it tests that a spec
can fail, not that it fails consistently.

Liveness proves each spec fails against an empty page. It does not prove a spec
asserts the right thing, and it would fail a correct spec whose requirement an
empty page happens to meet -- that an unknown path answers 404, for instance.
The same goes for specs that share state: when a `beforeAll` hook fails, or a
test in a serial describe block, Playwright marks the tests after it skipped, and
this script reports a skipped spec. There is no exemption for either; one would
be a change to this script, and a decision to take when such a spec exists.

An assertion of absence alone is exactly what an empty page can satisfy,
and so can a page that failed to render. An absence is therefore asserted only
after a presence: after the list it would be missing from has visibly rendered,
or after the same question has been shown to have an answer.

A spec fails against the empty page by waiting out its timeout, so a longer
timeout is a longer wait in `Gate liveness`. That is why `test.slow()`, which
triples it, is a rule about how much a spec writes rather than a tag to reach
for: a spec that writes three or more Entries through the form carries it.

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
check allowed to be red is only worth having when someone's job is to read it.
There nobody's is: ADR-0002 gives a feature pull request no reviewer, and the
check would report on specs that branch was never meant to satisfy. The
advisory push run is allowed to be red too, and the reader is what separates
them -- it lands on the milestone as it now stands rather than on one branch's
proposal, and `/implement-issue`'s loop names the driver as the one who reads
it and tells a spec waiting for its Task from a regression (#71).

**A job in `ci.yml`, scoped by `if:` to pull requests into `main`.** It was the
first version of this change, chosen because `Spec isolation` and
`Apply migrations` are scoped that way, and review found it fails open. GitHub
reports a job skipped by `if:` as successful, including to a required check. A
pull request opened into a milestone skips the job; retargeted to `main` later
-- which GitHub does by itself to open pull requests when their base branch is
merged and deleted -- it gets no new run, because a base change is an `edited`
event and `pull_request` does not listen for it by default. The skipped,
successful check would stand. A workflow filtered out by `branches:` reports no
check at all, so the same pull request waits for a run. Listening for `edited`
instead would rerun every job in `ci.yml` whenever a title or description
changed.

**Liveness inside `E2E build`.** It reuses that job's chromium, but it would run
only into `main`, so a spec that asserts nothing would sit on a milestone, with
feature work built against it, until the milestone was finished.

**"Every spec failed" as the whole liveness rule.** The run with no browser
passes it.

**Liveness in `pnpm gates`.** Every other `verify:gates:*` script is there, but
this one needs a browser installed and about 36 seconds, and `test:e2e`, the
suite it checks, is outside `pnpm gates` already.
