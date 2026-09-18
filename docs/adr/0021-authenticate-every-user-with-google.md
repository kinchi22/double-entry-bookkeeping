# ADR-0021: Authenticate every user with Google

**Status:** Accepted
**Date:** 2026-09-18

## Problem

The production write path is open to the internet. ADR-0017 accepted that until
the production database stopped being disposable, and decided what would close
it: one owner, a hashed password in the environment, no sign-up, no owner
column.

That decision assumed one user. The app is going to have many, soon, and each
keeps books nobody else can see. ADR-0017 names the multi-owner case "a different
decision, and a bigger one", and every part of it that a second user would change
-- the credential in configuration, the absent sign-up, the absent owner column
-- would be built and then removed.

Production holds nothing worth keeping (ADR-0009), so the wipe ADR-0017 tied to
adoption costs nothing now.

Two facts constrain the mechanism. `arctic`, the OAuth client first considered,
is deprecated on npm as of 2026-07-29 (3.7.0). `next-auth`'s `latest` tag is
still 4.24; v5 has never left beta, and the project is maintained by the Better
Auth team for security fixes.

## Decision

**Who.** Anyone with a Google account may sign up. Signing in with Google for the
first time creates a User. Google is the only provider.

**What they own.** Books are isolated per User. `entries` gains `user_id`, a
foreign key to `users` with `ON DELETE CASCADE`; an Entry line belongs to a User
through its Entry. There is no `books` table: with isolated books it would be an
abstraction with one shape and no behaviour.

**Where isolation is enforced.** In the application, not in Postgres. Every
repository port method that reads or writes user data takes a `userId`, required
by its signature, so omitting it is a type error. Each adapter filters on it, and
its `*.integration.test.ts` asserts that one User's rows are invisible to
another. A row owned by someone else is `NOT_FOUND`, never `FORBIDDEN`, so an id
reveals nothing about whether it exists.

**The feature.** `packages/core/src/auth/`, shaped like `health/`, holds User,
Identity and Session. An Identity is one sign-in method attached to a User:
`(provider, provider_subject)`, where the subject is Google's `sub`. A User is
found by its Identity, never by its email, because an email can change. `users`
stores `id` (uuid v7), `email`, `name` and `created_at`; no avatar. The word
Account is not used, because the glossary already means the chart of accounts.

**The mechanism.** `openid-client` performs the Google flow -- discovery,
authorization code with PKCE, ID token signature and claim validation -- behind a
port in `auth/adapters/`. The session is ours:

- A session token is 32 random bytes. The cookie carries the token; the
  `sessions` table stores its SHA-256 hash, the User and an expiry. Node's
  `crypto` does both, with no further dependency.
- The cookie is named `session`, and is `HttpOnly`, `Secure`, `SameSite=Lax`
  (Lax, because the return from Google is a top-level cross-site navigation).
  It carries no `__Host-` prefix: `E2E build` serves the app over
  `http://127.0.0.1`, and the name is part of the specs.
- A session lasts 30 days and slides: a request in its second half extends it.
- Signing out deletes the row, so it takes effect at once, and any session can be
  ended from the database.
- OAuth `state` and the PKCE verifier live in a short-lived cookie of their own
  for the length of the round trip.

**The request path.** `apps/web/server/context.ts` resolves the cookie to an
auth context and puts it on the request context. Each use case that touches user
data takes it and checks it at its entry point: the fixed decision in
`docs/ARCHITECTURE.md`, exercised for the first time. A procedure called without
a Session answers `UNAUTHORIZED`, 401.

Four things answer anybody: `/`, `/sign-in`, the Google callback at
`/auth/callback/google`, and `health.get` (ADR-0020). `/` is the page a
signed-out visitor meets, a welcome page in time, and it sends a signed-in User
to `/entries`. Every other page sends a request with no Session to `/sign-in`;
that redirect is a courtesy, and the use case check is the one that holds. After
signing in, the User returns to the path they asked for, accepted only as a
same-origin relative path, or lands on `/entries` when there is none. A callback
whose `state` the app did not issue returns to `/sign-in` with an error and
creates no Session.

**Configuration.** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` join
`DATABASE_URL`, validated by `parseEnv` (ADR-0005), and are set in Vercel's
project environment per deployment scope.

**Test sign-in.** When `AUTH_TEST_LOGIN` is set, `/sign-in` also renders a form
that signs in by an identifier, through a Server Action. One identifier is one
User: its Identity has the provider `test` and the identifier as its subject, so
a new identifier creates a User the way a first Google sign-in does. Each spec
signs in as a User of its own, and a spec can sign in as two. It exists for
`E2E build` and for Preview, where Google cannot redirect: Google accepts no
wildcard redirect URI and every Preview has its own URL. `parseEnv` fails when `AUTH_TEST_LOGIN` is set and `VERCEL_ENV` is
`production`, and its unit test asserts that refusal. Real Google sign-in works
on Production and on a local development server only.

**The smoke User.** The smoke run reads Production signed in. A smoke User exists
there with no Identity, so there is no way to sign in as it, and owns a fixed set
of Entries. Its one Session has a fixed expiry of one year and does not slide.
The token is the GitHub secret `SMOKE_SESSION_TOKEN`; the database holds its
hash. The owner creates the User, its Entries and its Session once, with a
script, and rotates the token by running it again. `@smoke` specs stay reads
(ADR-0014): the sign-in page, `health.get`, and the entries list of the smoke
User.

**How it ships.** Expand, then contract, because ADR-0013 lands a migration on
`main` before the milestone that needs it:

1. A migration on `main` adds `users`, `identities` and `sessions`, and
   `entries.user_id` as a nullable foreign key.
2. `milestone/authentication` writes `user_id` on every Entry and filters every
   read by it, so an Entry with no User is invisible.
3. A second migration on `main`, after the milestone merges, deletes every Entry
   with no User -- this is the wipe ADR-0009 promised -- and sets `user_id`
   `NOT NULL`.
4. The smoke User is seeded after the second migration.

**When to look again.** Adding a sign-in method this app verifies itself -- a
password, TOTP, a passkey -- re-evaluates `better-auth` against this design. A
second OAuth provider does not.

## Consequences

Every existing use case that touches Entries changes signature, and so does every
repository port under it. The E2E specs that write sign in first, through the test
sign-in.

The session code is ours: token generation, hashing, lookup, sliding and
deletion. It is small, and it is inside `domain`, `application` and `adapters`, so
the mutation score and the integration suite judge it. The hard part of OAuth --
validating the ID token -- is not.

The test sign-in is a way into the app that exists in product code. What keeps it
out of Production is a check at startup and the unit test on that check, not its
absence.

On Preview, anyone who gets past Vercel's Deployment Protection can sign in as
any test identifier. Preview's database is disposable, and nothing on it belongs
to a real User.

Preview cannot exercise real Google sign-in. The first place the real flow runs
against a deployment is Production.

A User's second factor is Google's business. The app cannot require one, and
Google does not reliably say whether one was used.

`SMOKE_SESSION_TOKEN` is a long-lived credential to Production. What it can reach
is the smoke User's own Entries, which is the isolation rule doing its job. It
expires within a year, and the smoke run fails on the day it does.

Sign-up is open, so anyone can create rows in Production. There is no rate limit
and no account deletion in this decision; `ON DELETE CASCADE` is there so that
deletion is a use case and not a migration when it comes.

Three dependencies arrive: `openid-client`, and through it `jose` and
`oauth4webapi`, all by one maintainer. They are proposed with the change that
introduces them, as `CLAUDE.md` requires.

## Rejected alternatives

**Adopt ADR-0017 as written.** A single owner with a password in the environment,
then a rewrite to multiple users. Every part a second user changes would be built
to be thrown away.

**Google sign-in, one allowed email, tenancy later.** Authentication without
ownership postpones the part that changes every repository, and the multi-user
work was next anyway.

**A `books` table, one per User.** The shared-book case is not a requirement;
with isolated books the table has one row per User and no behaviour. It is the
additive path if books are ever shared.

**Row-level security in Postgres.** Pooled connections to Neon need the User set
per transaction, which the Drizzle client does not do for us, and the
application check would still be required. The required `userId` parameter
catches the omission RLS exists to catch.

**`better-auth`.** It would own the session and the tables, which is its real
advantage. It also owns the write path: users and sessions are created inside its
`/api/auth/*` handler rather than by a use case, failures leave as its own
responses rather than a `Result`, and its instance needs the Drizzle client,
which `apps/web` may not import, while its Next.js cookie plugin needs `next`,
which `core` may not list. It brings `kysely`, `better-call` and `nanostores`
besides. With Google as the only method, the code it saves is the session, and
that is small.

**`next-auth` (Auth.js v5).** Still a beta, in maintenance, with the same
ownership of routes, tables and callbacks as `better-auth`.

**`@node-oauth/oauth2-server`.** It implements the other side: an authorization
server issuing tokens to third parties. This app is a client of Google's.

**`arctic`.** Deprecated.

**A stateless signed session cookie.** No lookup per request, and no way to end a
session before it expires.

**An OAuth callback proxy for Preview**, bouncing Google's redirect to the
Preview URL carried in `state`. It works, and it is an open redirect unless the
target list is exact; the test sign-in gives Preview what it needs without one.

**One fixed test User.** Every spec would write into the same books, and no spec
could show that one User cannot see another's entries, which is the property this
decision exists for.

**Seed E2E sessions directly in the database from Playwright**, with no test
sign-in in product code. It keeps the back door out of the app, and leaves Preview
with no way in at all.

**Seed the smoke User in a migration.** The token's hash would be in the
repository. **Seed it from CI on every run.** The smoke job would hold a
production database credential, which ADR-0014 declined to give it.
