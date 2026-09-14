# ADR-0002: Land the specs first, under human review

**Status:** Accepted
**Date:** 2026-09-13

## Problem

`docs/ARCHITECTURE.md` reserved human review for five things: schema changes,
auth and permission logic, money, data migrations, and
`apps/web/server/container.ts`. Three of them are subjects, not paths. Nothing
can decide whether a pull request "touches money", so nothing could route one to
a person, and the list described an intention rather than a surface.

`.github/CODEOWNERS`, added in `6752419`, named paths instead, and named a
different set. The two lists have disagreed since. In particular `e2e/` was on
neither list until CODEOWNERS put it there, and `e2e/` is where the requirements
live.

The list also had a live consequence. `packages/config/eslint/layers.mjs`
exempted `apps/web/server/container.ts` from `no-restricted-syntax`, justified
in a comment by the file being read by a human. The only effect of that
exemption is to permit `import()`, and `container.ts` contains none -- so a rule
was switched off for a file that never needed it, on the strength of a review
promise no gate could check.

Underneath both is a rule with no mechanism. `CLAUDE.md` says one pull request
per acceptance criterion. The acceptance criteria are the Playwright specs, and
an agent that changes a spec and the code the spec judges in one pull request can
make a failing requirement pass by rewriting the requirement. The reviewer of
that pull request sees the spec edit sitting next to the change that motivates
it, which is the worst possible place to judge it from.

Separating them is not enough on its own, because it leaves the order open, and
one of the two orders is worthless. If a spec may only land green, it can only
land after the behaviour it describes -- at which point it is a description of
an implementation rather than a requirement, and the human approving it is
approving code they were never shown. The repository needs somewhere a failing
spec can live while the behaviour that answers it is being built.

## Decision

### The approval

Every pull request into `main` needs one approval. An agent cannot land anything
on `main` alone, and a milestone branch is the only place it works unattended.

That is one rule instead of a classifier. Nothing needs to decide whether a
change is "product code" or "tooling", which is a question no path can answer:
logic put in `packages/core` is as much a behaviour as logic put in
`apps/web/app`.

### The surface

On top of the approval, three paths are owned:

- `e2e/**` -- the requirements, stated as executable specs.
- `packages/db/drizzle/**` -- an applied migration is the one change a later fix
  cannot undo.
- `.github/**` -- the gates, and the ownership list itself.

The surface is stated twice, in `docs/ARCHITECTURE.md` and in
`.github/CODEOWNERS`, and `tools/gates/review-surface-gate.test.ts` fails when
the two stop being the same set. Two lists free to disagree is the problem
above, not an incidental detail of it.

Ownership means different things on either side of the trunk. Into `main` it
decides whose approval counts, since one is required regardless. Into
`milestone/**` it is the whole rule: no approval is required there, so an owned
path in the diff is exactly what pulls a person in.

### The order

A specification lands before the behaviour it describes, on a milestone branch:

1. `milestone/<name>` is branched from `main`, one branch per acceptance
   criterion.
2. The specs land on it first, in their own pull request, which the owner
   reviews because `e2e/**` is in its diff.
3. Feature branches target the milestone. They carry no owned path, so they
   merge without a human -- and they may not touch `e2e/**`, which is what the
   isolation rule below enforces. A spec that turns out to be wrong is corrected
   in its own pull request onto the milestone, reviewed like the first one.
4. `main` is merged into the milestone by pull request when the milestone falls
   behind.
5. `milestone/<name> -> main` is the integration pull request. Every spec is
   green by then, and the owner approves it -- as they approve everything that
   reaches `main`.

The `main` ruleset covers `refs/heads/milestone/**` as well, so a milestone
branch takes no direct pushes and no force pushes either: everything above
arrives as a reviewed or checked pull request. (Since step 3 there are two
rulesets rather than one -- `main` on the default branch, `milestone` on
`refs/heads/milestone/**` -- and both require a pull request and block force
pushes, so this still holds.)

### The isolation rule

A pull request changes `e2e/**` or it changes the rest of the repository, never
both. `tools/check-pr-isolation.ts` decides that from the pull request's file
list, and the `Spec isolation` job fails when both sides moved. The list comes
from `GET /repos/{owner}/{repo}/pulls/{number}/files`, including
`previous_filename`, so a spec moved out of `e2e/` counts as touching both sides.
An empty list fails rather than passes: a pull request always changes something,
so nothing to check means the query broke.

The exemption is the integration pull request, in either direction -- a branch
matching `^milestone/[a-z0-9][a-z0-9-]*$` meeting `main`. It carries a whole
milestone, specs and behaviour together, and both halves were reviewed or
checked on the way in.

### What comes off the list

Schema changes, auth and permission logic, money and `apps/web/server/container.ts`
come off. A schema change cannot reach main without its migration
(`pnpm db:drift`), so it arrives at an owned path anyway. Money is a branded
integer whose arithmetic lives in `packages/core/src/money/domain`, inside the
`mutate` glob of the mutation threshold. Auth does not exist, so reserving review
for it reserved nothing; when it arrives it will sit at use-case entry points,
and whether that deserves an owner is a decision to take with the code in front
of us rather than four phases early. `container.ts` loses its lint exemption in
the same change, so review is no longer what makes it safe.

## Consequences

The requirement is agreed before the code exists, which is the point, and the
red specs on a milestone branch are its progress bar. Nothing else in this
repository shows how much of a criterion is done.

The human's leverage sits in two places: the spec, and the trunk. Feature pull
requests onto a milestone merge with no approval at all, by design -- what they
may do was decided when the spec was approved, and what they may not do, touch
the spec, is checked rather than reviewed. A migration is the exception, because
CODEOWNERS matches paths, not branches: a feature pull request carrying one
still needs the owner, even onto a milestone.

The cost of the approval rule is that it applies to everything. A one-line
document fix, a gate, a dependency bump: each needs a person, so the agent's
unattended throughput is whatever fits on a milestone branch between two
approvals. The gain is that there is no path rule to route around, and the
pressure points the right way -- the way to work unattended is to open a
milestone, which is where a specification comes first.

What the approval does not do is make ordering mechanical. It stops code nobody
reviewed; it does not stop a behaviour arriving with no specification, because no
check can tell a behaviour from a refactor. A product change can still come
straight to `main`, and what refuses it is the reviewer, now backed by a hard
stop rather than by hoping the pull request is noticed.

Renaming a `data-testid` is a spec change: its own pull request, reviewed.

`CLAUDE.md`'s "trunk-based" stops being literally true. A milestone branch is an
integration branch, and `main` receives a criterion at once rather than
continuously. Feature flags remain the answer for anything incomplete that
reaches `main`; inside a milestone, incomplete is the normal state and needs no
flag.

`pnpm gates` cannot run the isolation check: it reads a pull request. CI passing
is a stronger claim than `pnpm gates` passing.

Five limits, stated rather than discovered:

- The job reports; it blocks only once `Spec isolation` is added to the ruleset's
  required checks. That is a repository setting, not a file in this diff. (Both
  rulesets require it.)
- The E2E suite must be green for `milestone -> main` and must not block a
  feature pull request that is halfway through a milestone. Required checks
  belong to a ruleset, and one ruleset currently covers both `main` and
  `milestone/**`, so that split needs a second ruleset scoped to the default
  branch. The job itself does not exist yet either; both are step 6. (The second
  ruleset was created in step 3. What remains is the job, and requiring it on the
  `main` ruleset alone.) (Step 6 added the job, `E2E build`, in ADR-0006, and
  the `main` ruleset alone requires it.)
- The exemption keys on a branch name, so an agent can create a
  `milestone/<name>` branch that already contains specs and behaviour together
  and open it against `main` with the isolation check switched off. What stands
  behind that is the owner's approval: the specs are in the diff, so CODEOWNERS
  requests it.
- `GET /pulls/{number}/files` returns at most 3000 files. A larger pull request
  would be checked against a truncated list, which the empty-list guard does not
  catch. The fix, if anything ever approaches it, is to compare the list against
  the pull request's own `changed_files` count.
- The check itself lives in `tools/`, which no one owns, so an agent can weaken
  it in a pull request that needs no approval. What stands behind it is
  `.github/**`: the job that runs it is owned, and a check that stops running is
  a diff in an owned file. The code it runs is not.

## Rejected alternatives

**Behaviour first, spec afterwards.** This was the first reading of this record,
and it is worthless: a spec written after the implementation describes the
implementation, and the owner approving it is approving code they were never
shown. The milestone branch exists so that the opposite order is possible.

**Specs onto `main`, red, with the E2E suite not required.** A gate that is
allowed to be red is a gate nobody reads. This repository's whole design is that
a rule which does not fail the build is not a rule.

**Specs onto `main`, skipped, then un-skipped once the behaviour lands.** Every
pull request stays green, but a skipped spec on `main` is a dead gate with no
expiry, it takes a third pull request per criterion, and nothing fails if the
un-skip never comes.

**Forcing product changes onto a milestone by path.** A rule that a pull request
into `main` from any other branch may not touch the product source. Drawn
narrowly -- the pages and the components -- it is routed around by putting the
logic in `packages/core`. Drawn widely -- every package's `src` -- it charges a
branch and two pull requests for a rename, and buys no oversight at all, since a
milestone carrying no spec change needs no approval either. The approval on
`main` gets the same protection with nothing to classify.

**Keep the five-item list.** It cannot be applied mechanically, because three of
its five entries are subjects rather than paths. It went unchallenged precisely
because nothing consulted it: a list no tool reads cannot be found to be wrong.

**CODEOWNERS alone, with no isolation check.** Ownership makes a spec change
require an approval; it does not stop the spec change from riding along with the
code it judges. One approval covers the whole pull request, and the reviewer is
shown the rewritten requirement next to the reason it was rewritten.

**Reviewing feature pull requests onto a milestone too.** It would make the
owner a bottleneck for every commit and buy nothing: the criterion was already
agreed, and the one thing a feature branch must not do is checked.

**A label that skips the isolation check.** A bypass the machine account can
apply is not a boundary. The account that opens the pull request can set its
labels.

**A `git diff` against the base branch in the job.** It needs the merge base, so
it needs `fetch-depth: 0` and the right base ref, and both fail quietly by
reporting fewer files than changed. The pull request files API states the list
directly, with renames, and has no checkout depth to get wrong.

**A step inside the `Gates` job.** `Gates` also runs on push to `main`, where
there is no pull request number. A check that must not run on push is clearer as
its own job, which is also what lets the ruleset require it by name.

**Making `e2e/` read-only to agents.** Requirements change, and a rule that
forbids the change outright would be routed around by writing the new
requirement somewhere else. The rule is isolation and order, not immutability.
