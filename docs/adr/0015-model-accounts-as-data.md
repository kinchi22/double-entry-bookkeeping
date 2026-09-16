# ADR-0015: Model accounts as data

**Status:** Deferred
**Date:** 2026-09-16
**Trigger:** A criterion needs an account the fixed chart does not name, or the
owner needs to rename, add or retire one.

## Problem

Every entry line names an account (ADR-0010). Phase 1 fixes five of them as a
constant in `domain/` -- `cash`, `payable`, `capital`, `sales`, `expense` -- one
per account type, stored on the line as a code.

Real books outgrow that. A chart of accounts is the owner's vocabulary: they add
accounts, rename them, and stop using them without erasing the entries that
reference them. None of that is possible while the chart is a constant compiled
into the domain.

Building it in Phase 1 would put a second feature -- a table, a repository, a
list, a form -- inside the slice whose job is to be the smallest complete path
through the layers.

## Decision

When the trigger holds, accounts become their own feature. None of this is in
force before then.

- `packages/core/src/accounts/`, with the layers `CLAUDE.md` names, and
  `packages/contracts/src/accounts.ts`.
- An `accounts` table: `id` (`AccountId`, uuid v7), `code`, `name`, `type`
  (asset, liability, equity, revenue, expense), and an archived flag. `code` and
  `name` are the owner's; `type` is the fixed vocabulary of double-entry
  bookkeeping and stays a domain constant.
- `entry_lines.account_code` becomes `account_id`, a foreign key. The migration
  seeds the five existing codes first, maps every existing line onto them, and
  drops the code column in a later release, per the backwards-compatible rule in
  `docs/DEPLOYMENT.md`.
- The chart constant in `domain/` is deleted. Validating that a line names a real
  account becomes a repository read in the use case, not a pure check.
- An account is archived, never deleted, because entries reference it forever.

## Consequences

Adoption is a data migration of every entry line, which is the one change a later
fix cannot undo. It lands under `packages/db/drizzle/`, which the owner owns.

The domain loses a compile-time-known set of accounts, so a use case that today
validates purely will need the repository. That is a real loss of testability,
and it is what having user-owned data costs.

Until then, an entry can only be posted against the five codes above. A book
that needs a sixth is blocked, which is the trigger.

## Rejected alternatives

**Build it in Phase 1.** A second feature inside the reference slice, before any
criterion asks for it.

**Free text on the line.** No table, no migration, and a typo becomes a new
account that reports silently disagree about.

**A Postgres `enum` for the codes.** Adding a value is a migration, and the
values are the owner's words, not the schema's.

**Keep the chart in the domain and edit it in code.** Every new account is then a
deployment, and the owner cannot name their own books.
