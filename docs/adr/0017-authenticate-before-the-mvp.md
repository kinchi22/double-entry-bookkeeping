# ADR-0017: Authenticate before the MVP

**Status:** Superseded by ADR-0021
**Date:** 2026-09-16
**Trigger:** Before the production database stops being disposable -- that is,
before the wipe in ADR-0009 and the first real books entered after it.

## Problem

Phase 1 ships no login. Anyone who opens the app can create an entry.

That is survivable today and not afterwards. Vercel's Standard Protection covers
a deployment's own URL, which answers 302 to a Vercel login; the production
domain answers 200 to anybody (measured in ADR-0009, which is why the smoke run
needs a bypass header for one and not the other). Production's data is disposable
until the MVP, so the cost of an open write path right now is junk rows in a
database that gets wiped. After the wipe the same open path is a stranger writing
in the owner's books.

Building it in Phase 1 would also change what the reference slice demonstrates.
The slice exists to show the path through the layers; a login is a second
feature, with a session, a form and a redirect, none of which the criterion asks
for.

One fixed decision has nothing to check in the meantime: "Authorization is
checked at the use case entry point; controllers pass the auth context." With no
auth, the entries use case takes no auth context, so the reference slice does not
show the pattern later features are meant to copy.

## Decision

When the trigger holds, the app authenticates a single owner. None of this is in
force before then.

- One account, not a sign-up flow. The owner's credential is configuration --
  environment variables validated by `apps/web/server/env.ts`, like
  `DATABASE_URL` -- with the secret stored hashed, never in the repository.
- A Server Action signs in, as every other write does, and sets a session in an
  `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Signing out clears it.
- `apps/web/server/context.ts` reads the cookie and puts an auth context on the
  request context; `apps/web/server/container.ts` passes it down. Each use case
  that needs it takes it as an argument and checks it at its entry point, which
  is the fixed decision above, finally exercised.
- Entries gain no owner column. With one owner, the check is authentication, not
  per-row authorization; a second owner is a different decision, and a bigger one
  (a book that rows belong to).
- The mechanism needs a hash and a signed cookie. The adopting change proposes
  the dependency with a reason, as `CLAUDE.md` requires, and re-checks its
  versions then.

## Consequences

Between now and adoption the production write path is open to the internet. The
mitigation is that the data is disposable and the wipe happens at adoption; the
exposure is real and it is accepted for that window only.

Adoption changes the signature of every existing use case that will check the
context, and the E2E specs, which then have to sign in before they can create an
entry. The smoke specs stay read-only (ADR-0014), so they need a page that
renders signed out, or a session of their own.

A single-owner credential in configuration means rotating it is a Vercel change
and a redeploy, not a page in the app.

## Rejected alternatives

**Build it in Phase 1.** The reference slice doubles in size, and the criterion
that justifies the work does not exist yet.

**Password-protect the production domain in Vercel.** It is a paid feature, and
it authenticates a visitor to a deployment rather than a user of the books: one
shared password, no identity, nothing a use case can check.

**An auth framework now** (Auth.js and its kind). Providers, a database adapter
and a callback surface, for one user who is also the person deploying the app.

**An owner column on every entry, filled with a constant.** It looks like
multi-tenancy and is not, and the real multi-owner decision would still have to
choose what a row belongs to.
