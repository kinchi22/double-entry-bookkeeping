# ADR-0001: Record architecture decisions

**Status:** Accepted
**Date:** 2026-09-12

## Problem

`docs/ARCHITECTURE.md` states the rules that hold today. It has nowhere to put
two other things, and both were lost because of it.

The first is a decision that has been taken but deliberately not built. The i18n
rule is the worked example: `docs/GLOSSARY.md` claimed that user-facing copy
lives in resource files and `packages/config/eslint/base.mjs` carried three glob
exemptions on that basis, while every string in the app was inline and no gate
could see the difference. The claim was written where only current rules belong,
so it read as a rule and behaved as a wish. The alternative on the table was
deleting it, and the objection to deleting it was exactly right: the directory
shape and the resolution order would have to be reinvented later, probably
differently.

The second is the reasoning. Commit messages carry it, but they are addressed to
the diff, not to the next person choosing between the same alternatives. Nothing
tells a reader which alternatives were already considered and lost.

## Decision

`docs/adr/` holds one file per decision, numbered from `0001`, named
`NNNN-kebab-case-title.md`, following `docs/adr/template.md`.

The two files divide as follows. `docs/ARCHITECTURE.md` states the rule as it
stands and indexes the records. An ADR states the problem, the decision, the
consequences, the rejected alternatives, and a status. A `Deferred` ADR is a
decision that is **not** in force, carrying a `**Trigger:**` line saying what has
to be true before it is; adopting it edits that same file rather than writing a
new one, so the record of a rule and the record of why it waited stay together.

`CLAUDE.md` is amended to treat an Accepted ADR as binding alongside
`docs/ARCHITECTURE.md`, because an agent that only reads one of them will
reinvent whatever is in the other.

`tools/gates/adr-gate.test.ts` enforces the shape: numbering, the status
vocabulary, the required sections and that none is left empty, a trigger on
every deferred ADR, an adoption line on every ADR that carries a trigger and is
in force, an existing target for every supersede, and the index in both
directions -- including its status column against the status in the ADR, so
adopting one and forgetting the table fails. The template is checked too, since
it is the shape everything else is copied from. Without all of this, "deferred,
and updated when adopted" is a habit, and this repo already has one example of
what happens to those.

Decisions taken before this one stay where they are, in `docs/ARCHITECTURE.md`
and in the commit that made them. They are not backfilled.

## Consequences

Two files to keep honest instead of one. The gate catches the mechanical half of
that -- a missing entry, a dangling row, a status the two disagree on -- but not
the semantic half: a rule stated in `ARCHITECTURE.md` can contradict the prose of
the ADR it links to and nothing notices. That stays a review concern.

Not backfilling leaves the record inconsistent: the four decisions made before
this one (testcontainers over the shared database, the `uuid` package, Server
Actions as the write path, JSON-safe contracts) have commit messages and a table
row, not records. Rewriting them would mean restating what those commits already
say, in a format that adds nothing to a decision nobody is revisiting.

A `Deferred` ADR is a standing invitation to build the thing early. The status
line and `CLAUDE.md` both say to stop and ask instead, and neither is a gate.

## Rejected alternatives

**`docs/ROADMAP.md`.** `CLAUDE.md` names `docs/ARCHITECTURE.md` as the file that
settles whether a decision exists. A roadmap it does not reference is a file
agents have no reason to open, which reproduces the failure this record exists
to fix.

**Keeping everything in `docs/ARCHITECTURE.md`.** It has no way to say "decided,
not in force". Adding one would make every reader work out, per line, whether
they are reading a rule or a plan.

**A fixture directory for this gate.** The escape hatch is recorded in
`fixtures/README.md` instead. What a fixture proves is that a tool still resolves
paths and still matches; this gate is a function over values, where the same
breakages are inputs the test can state directly, next to the expected message.

**Backfilling every past decision.** It rewrites history that the commits
already carry, and it inflates the directory with records whose alternatives
nobody will weigh again.
