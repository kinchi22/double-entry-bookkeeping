# ADR-0022: Make every harness read one working agreement

**Status:** Accepted
**Date:** 2026-09-22

## Problem

The working agreement can only be read by one agent harness. `CLAUDE.md` holds
the rules, `.claude/settings.json` enables the refinement skills, and
`/implement-issue` lives under `.claude/skills/`. Opening the same clone in
Codex gets none of it: no rules, no tracker conventions, no driver loop. The
owner wants to work from Codex as well, and today that means either working
without the agreement or keeping a second copy of it by hand -- a copy that
would be right about a rule in one harness and wrong about it in the other.

The rules themselves are not Claude-specific. What is Claude-specific is where
they are written and what they are named after: a `general-purpose` subagent, a
`SendMessage` tool, `.claude/worktrees/`. Those are one harness's implementation
of concepts both harnesses have.

Four facts about the two harnesses fix the shape of any answer:

- Codex reads `AGENTS.md`, merges one file per directory from the repository
  root down to the working directory, caps the merged result at 32 KiB, and
  supports no import syntax. So the shared agreement must be self-contained
  prose in `AGENTS.md`.
- Claude Code reads `AGENTS.md` natively only when no `CLAUDE.md` or
  `CLAUDE.local.md` exists anywhere up the tree. The setting that changes this
  is user-scoped, so a repository cannot commit it, and a contributor with a
  personal `CLAUDE.local.md` would silently stop reading the agreement. So
  `CLAUDE.md` has to stay, and has to point at `AGENTS.md`.
- Claude Code does not read anything under `.agents/`; Codex does not read
  anything under `.claude/`. So a Skill that both harnesses can run cannot live
  in either directory alone.
- Codex drops symlinks when it copies a plugin into its cache, and its behaviour
  for a repository-local symlinked skill is undocumented.

This ADR lands before the layout it describes, the way ADR-0013 did: the
decision is what the following pull requests are checked against, and a reader
who later finds a one-line `CLAUDE.md`, Skill bodies under `docs/`, and an MIT
skill set that is deliberately not vendored should find the reasons in one place
rather than reconstructing them.

## Decision

**One agreement, in `AGENTS.md`.** It is self-contained prose and points readers
at `docs/ARCHITECTURE.md`, `docs/GLOSSARY.md` and `docs/agents/` by name rather
than by import. `CLAUDE.md` is the single line `@AGENTS.md` and holds no rule of
its own, so there is nothing to keep in sync.

**Harness-specific names live in one file.** `docs/agents/harnesses.md` maps a
neutral concept to each harness's mechanism and defines the Harness vocabulary.
It is the only file permitted to name `.claude/` or `.codex/`. Shared prose says
"Implementer Subagent" and "send the findings back to the same Subagent", never
a tool name, so an instruction an agent cannot literally execute is not mistaken
for one it may skip.

**The Harness vocabulary is defined in `docs/agents/harnesses.md`, not in
`docs/GLOSSARY.md`.** Harness, Working agreement, Skill, Driver, Implementer,
Subagent and Agent worktree are the terms this decision needs, and none of them
is a bookkeeping term: `docs/GLOSSARY.md` names what the product is built from,
and these name how it is worked on. Mixing them would make the domain glossary
mean less than it says. So that "one canonical name per concept" still has one
index, `docs/GLOSSARY.md` gains a preamble pointer to that second table, and no
term is defined in both.

**A Skill's prose lives once, under `docs/agents/skills/`, and each harness gets
a stub that points at it.** The stub is one pointer line and carries only the
keys its own harness reads. Neither harness reads the other's skill directory,
so the pointer is what makes one body reachable from both.

**The external skills are not vendored.** `code-review`, `tdd`,
`grill-with-docs`, `to-spec` and `to-tickets` stay upstream. Claude Code
installs them through `enabledPlugins` in the committed `.claude/settings.json`;
Codex has no committed equivalent, so `README.md` names the install route for
each harness.

**`implement-issue` is human-only in both harnesses.** It is reachable when the
owner types it and never because a model matched a description.

## Consequences

A rule changes in exactly one file. It can no longer be true in one harness and
false in the other, and the cost of that is that `AGENTS.md` must stay prose a
reader can follow without an import mechanism: a rule that wants to live in a
shared fragment has nowhere to go but inline.

Two files now point at each Skill body, so a renamed body can leave a harness
with a dead pointer, and a stub edited on one side can drift from the other.
Neither failure shows up when the harness that still works is the one in use.
The Feature that lands this layout gates both, along with the one-line
`CLAUDE.md`, the `docs/agents/` index and the ban on vendor directories in
shared prose.

This record uses the Harness vocabulary -- Harness, Skill, Subagent, Skill body,
Skill stub -- before the table defining it exists, because it lands ahead of the
layout for the same reason it lands at all. `docs/GLOSSARY.md` asks that a new
concept be named in the commit that introduces it; the seven terms are named in
`docs/agents/harnesses.md` instead, and that file arrives with the mapping it
holds, in a later Task of the Feature carrying this decision. Until it does, the
capitalised terms here are read from this ADR's own prose. The price is a
window, this pull request to that one, where the vocabulary is used and not
indexed, and a second table to keep a term out of once it exists.

Not vendoring the external skills means upstream fixes arrive without work here,
and that a clone is not self-contained: a newcomer runs an install step before
refinement works, and Codex has no committed configuration to do it for them.
`README.md` carries that step. An upstream change can also alter a skill under
this repository's feet, which no gate here can catch.

`implement-issue` stays human-only because it is a loop that claims issues,
opens pull requests and merges them. A model that started it by matching a
description would be acting on the tracker without anyone having asked. The cost
is that no Skill and no Subagent can reach it -- nothing does today, and both
harnesses forbid it anyway for a user-invoked Skill. Because a human is the only
caller, its `description` is written as a summary for someone reading a picker
rather than as a list of trigger phrases.

Two fields carry that policy, one per harness, and reversing it means flipping
them -- a decision of its own rather than a detail of some later change. This
record is what fixes their values for the Task that writes the stubs:

- `disable-model-invocation` in the frontmatter of the Claude Code stub, set to
  `true`.
- `policy.allow_implicit_invocation` in the sibling `agents/openai.yaml` for the
  Codex stub, set to `false`.

Personal instructions have a home outside the repository -- `~/.codex/AGENTS.md`
for Codex, `CLAUDE.local.md` for Claude Code -- because the in-repository
override this decision rejects would discard the agreement rather than extend
it.

Nothing here is built for a third harness. The layout does not obstruct one:
adding it means a stub directory and a row in `docs/agents/harnesses.md`.

## Rejected alternatives

**Symlink one harness's skill directory at the other's.** The obvious answer,
and the one upstream chose in the opposite direction. Claude Code follows a
symlink when reading, but its Edit tool refuses to write through one, so the
Skill bodies become read-only to the agent that maintains them. Git on Windows
checks a symlink out as a plain text file containing the target path unless
`core.symlinks` is set, so a clone there gets a Skill whose body is one line of
nonsense. Codex drops symlinks when it copies a plugin into its cache, and its
behaviour for a repository-local symlinked skill is undocumented, which makes
the arrangement work by luck on the harness this is being built for.

**Vendor copies of the external skills.** A committed fork of someone else's MIT
skill set is a second source of truth that no gate can check against upstream,
and it silently freezes the version: a fix lands upstream and this repository
keeps running the bug until someone notices. It also makes this repository the
apparent maintainer of prose it did not write.

**Commit an `AGENTS.override.md` carrying the Claude-specific half.** Codex's
override *replaces* the `AGENTS.md` in the same directory rather than extending
it, so at the repository root it would discard every rule in the agreement while
reading as "my extra notes". The name is dangerous enough that `.gitignore`
excludes it rather than leaving it merely unused.

**Define the Harness terms in `docs/GLOSSARY.md`.** It is already the one index
of canonical names, and the glossary's own rule is that a new concept is named
there in the commit that introduces it. But that table is the domain's: an agent
harness is not something the product is built from, and seven rows about
Subagents and worktrees sitting between Entry line and Money would make
`docs/GLOSSARY.md` stop meaning what its preamble says it means. A pointer from
the preamble to the second table keeps the single index without the dilution.

**Duplicate the agreement as `AGENTS.md` and `CLAUDE.md`, kept in step by a
gate.** A gate can compare two files, but it cannot tell which one is right when
they disagree, so every drift becomes a question for the owner. One file and one
import has no drift to detect.

**Leave `CLAUDE.md` as the agreement and let Codex read it.** Codex does not
read `CLAUDE.md`. Claude Code reads `AGENTS.md` only when no `CLAUDE.md` exists
up the tree, and that behaviour is controlled by a user-scoped setting a
repository cannot commit, so the direction of the import is not a preference.
