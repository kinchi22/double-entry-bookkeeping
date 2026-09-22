# ADR-0011: Make an aggregate write atomic

**Status:** Accepted
**Date:** 2026-09-16

## Problem

An entry is two tables (ADR-0010): a row in `entries` and its rows in
`entry_lines`. Half of that write is a ledger that does not balance, and nothing
in the schema would report it, so the two inserts have to be one unit.

The fixed decisions in `docs/ARCHITECTURE.md` say the transaction boundary is
owned by the use case and that repositories never begin a transaction. Taken
literally, the use case needs a way to express a boundary, and there is none:
the only ports today are a health probe and, after this milestone, an entry
repository. Adding a unit-of-work port so that one use case can wrap one
repository call is an interface with a single implementation, which `AGENTS.md`
forbids, and the thing it would abstract is `db.transaction`, which nothing else
would ever implement differently.

The rule exists to stop a repository from deciding how far a business operation
reaches. Writing one aggregate completely is not that decision.

## Decision

The rule has two halves.

- **A repository method that writes one aggregate is atomic by itself**, and may
  open a transaction internally to be so. `saveEntry(entry)` inserts the entry
  and its lines inside one `db.transaction`.
- **A boundary wider than one aggregate belongs to the use case.** A repository
  may not open a transaction spanning two aggregates, two of its own methods, or
  a call it does not make itself.

The second half has no mechanism yet, and gets one -- a unit of work the use
case drives -- when a use case first has to write two aggregates together. That
is when a port for it has something to abstract.

"Aggregate" enters `docs/GLOSSARY.md`: the entity a repository loads and saves as
one thing, with the entities it owns. An entry owns its lines; nothing else owns
an entry.

## Consequences

The rule can no longer be read off in one line, and the ARCHITECTURE row says
both halves so that nobody reads the short version.

A reviewer now has to judge what an aggregate is. Today there is exactly one, so
the judgement is cheap; it gets harder the first time an entity is referenced
from two places.

The use case cannot compose two saves atomically today. Nothing needs to, and
the first feature that does pays for the port, rather than this one paying for
it in advance.

Atomicity is a behaviour, so the adapter's `*.integration.test.ts` asserts it
against a real Postgres: a save whose second line the database refuses leaves no
entry row behind. That test fails if the transaction is ever removed, which is
what keeps this decision from decaying into a comment.

## Rejected alternatives

**A unit-of-work port now.** One implementation, wrapping one library call,
introduced so that a rule reads the same in both halves. `AGENTS.md` names this
exact shape as the abstraction not to build.

**Lines as a `jsonb` column on the entry.** One insert, no transaction, and the
question disappears. It also makes every later query that groups by account a
jsonb expression or a migration, and grouping by account is what a ledger is
for.

**Two inserts with no transaction.** A crash between them leaves an entry with
no lines, which reads as a balanced entry of nothing and is the exact failure
double-entry bookkeeping exists to make impossible.

**One SQL statement writing both tables through a CTE.** Atomic without a
transaction, and outside drizzle's insert builder, so the schema types stop
covering the one write that matters most.
