# ADR-0002: Reserve human review for the specs and the applied migrations

**Status:** Accepted
**Date:** 2026-09-12

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
it, which is the worst possible place to judge it from. Nothing detected this.

## Decision

Human review is reserved for two paths:

- `e2e/**` -- the requirements, stated as executable specs.
- `packages/db/drizzle/**` -- an applied migration is the one change a later fix
  cannot undo.

`.github/**` stays owned as well, because it holds the gates that every other
claim in this repository rests on, including this one.

The surface is stated twice -- in `docs/ARCHITECTURE.md` and in
`.github/CODEOWNERS` -- and `tools/gates/review-surface-gate.test.ts` fails when
the two stop being the same set. Two lists free to disagree is the problem
above, not an incidental detail of it.

A pull request changes `e2e/**` or it changes the rest of the repository, never
both. `tools/check-pr-isolation.ts` decides that from the pull request's file
list, and the `Spec isolation` job fails when both sides moved. The list comes
from `GET /repos/{owner}/{repo}/pulls/{number}/files`, including
`previous_filename`, so a spec moved out of `e2e/` counts as touching both sides.
An empty list fails rather than passes: a pull request always changes something,
so nothing to check means the query broke.

Schema changes, auth and permission logic, money and `apps/web/server/container.ts`
come off the list. A schema change cannot reach main without its migration
(`pnpm db:drift`), so it arrives at an owned path anyway. Money is a branded
integer whose arithmetic lives in `packages/core/src/money/domain`, inside the
`mutate` glob of the mutation threshold. Auth does not exist, so reserving review
for it reserved nothing; when it arrives it will sit at use-case entry points,
and whether that deserves an owner is a decision to take with the code in front
of us rather than four phases early. `container.ts` loses its lint exemption in
the same change, so review is no longer what makes it safe.

## Consequences

The specs stop being editable by an agent acting alone, which is the point, and
the cost lands on ordering. A new behaviour and its spec cannot arrive together:
the behaviour ships first and the spec follows in its own pull request, because a
spec that lands first is red against an application that does not implement it
yet. Feature flags, which `CLAUDE.md` already requires for incomplete work, are
how a behaviour lands quietly enough for that ordering to be comfortable.

Renaming a `data-testid` becomes two pull requests. That is correct rather than
unfortunate: the selector is part of the spec, and renaming it is editing the
requirement.

Every spec change now waits on the owner. Requirements move slower than code, on
purpose, and this is the only kind of change an agent cannot land alone.

The check is only as good as its input. It reads a pull request, so it cannot
run locally and `pnpm gates` does not include it: CI passing is a stronger claim
than `pnpm gates` passing. It also does not see a direct push to `main` -- the
`main` ruleset does, by refusing them.

Three limits worth stating rather than discovering:

- The job reports, and it blocks only once `Spec isolation` is added to the
  `main` ruleset's required checks. That is a repository setting, not a file in
  this diff, and only the owner can make it.
- `GET /pulls/{number}/files` returns at most 3000 files. A pull request past
  that would be checked against a truncated list, which the empty-list guard
  does not catch. Nothing here is near it, and the fix if anything ever is would
  be to compare the list against the pull request's own `changed_files` count.
- The check itself lives in `tools/`, which no one owns, so an agent can weaken
  it in a pull request that needs no approval. What stands behind it is
  `.github/**`: the job that runs it is owned, and a check that stops running is
  a diff in an owned file. The code it runs is not.

The rule is about paths, not intent. A typo fix in a spec comment needs the
owner, and a pull request that changes ten unrelated things is fine as long as
none of them is a spec. Isolation is not the same as small.

Removing the exemption from `container.ts` means a dynamic import there now fails
lint like anywhere else. If the composition root ever genuinely needs one, that
is a decision to take then, in this directory, rather than a permission left
lying around in advance.

## Rejected alternatives

**Keep the five-item list.** It cannot be applied mechanically, because three of
its five entries are subjects rather than paths. It went unchallenged precisely
because nothing consulted it: a list no tool reads cannot be found to be wrong.

**CODEOWNERS alone, with no isolation check.** Ownership makes a spec change
require an approval; it does not stop the spec change from riding along with the
code it judges. One approval covers the whole pull request, and the reviewer is
shown the rewritten requirement next to the reason it was rewritten.

**A label that skips the check.** A bypass the machine account can apply is not a
boundary. The account that opens the pull request can set its labels.

**A `git diff` against the base branch in the job.** It needs the merge base, so
it needs `fetch-depth: 0` and the right base ref, and both fail quietly by
reporting fewer files than changed. The pull request files API states the list
directly, with renames, and has no checkout depth to get wrong.

**A step inside the `Gates` job.** `Gates` also runs on push to `main`, where
there is no pull request number. A check that must not run on push is clearer as
its own job, which is also what lets the ruleset require it by name.

**Making `e2e/` read-only to agents.** Requirements change, and a rule that
forbids the change outright would be routed around by writing the new
requirement somewhere else. The rule is isolation, not immutability.
