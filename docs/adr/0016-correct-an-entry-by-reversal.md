# ADR-0016: Correct an entry by reversal

**Status:** Deferred
**Date:** 2026-09-16
**Trigger:** A criterion asks to change or remove an entry that is already
posted.

## Problem

Phase 1 creates entries and lists them. It offers no edit and no delete, so the
question of what happens to a mistake is open, and the answer shapes the schema:
an editable entry is a row with a history, an immutable one is a row plus a
second entry that cancels it.

Bookkeeping settled this long ago. A posted entry is not edited, because the
audit trail is the point of the ledger; it is cancelled by posting its reverse,
and the two stand side by side.

## Decision

When the trigger holds, correction is by reversal. None of it is in force before
then.

- Entries stay append-only. No update path, no delete path, no soft-delete flag.
- `entries` gains `reverses_entry_id`, nullable, referencing another entry. A
  reversal is an ordinary entry whose lines are the original's with `debit` and
  `credit` swapped, so the pair sums to nothing on every account.
- The use case builds the reversal from the original, so the caller supplies an
  `EntryId` and a date, not a set of lines.
- An entry may be reversed once. The list marks both the reversal and the entry
  it reverses.
- A correction is then a reversal followed by a new, correct entry.

## Consequences

A typo is permanent and visible, together with the entry that cancels it. That
is the intended property, and it is also what a person will complain about the
first time they mistype a memo.

The list grows two rows per correction, so it will eventually need a way to hide
reversed pairs. That is a listing criterion, not this one.

Nothing stops a hand-written reversal that does not match its original. The link
records intent; the balance is what makes the pair meaningful.

## Rejected alternatives

**Edit in place.** The cheapest interface, and it destroys the audit trail that
double-entry exists to keep. A ledger you can rewrite answers no question about
what happened.

**Soft delete with a flag.** It hides a mistake instead of explaining it, and
every report then has to remember the flag.

**Versioned entries, each edit a new revision.** It keeps history, and it invents
a second history mechanism beside the one bookkeeping already has, with reports
having to choose a revision.

**Decide it now and build it in Phase 1.** Nothing in Phase 1 has data worth
correcting: Production is disposable until the MVP (ADR-0009).
