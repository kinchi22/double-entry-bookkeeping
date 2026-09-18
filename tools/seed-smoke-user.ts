import { createHash, randomBytes } from 'node:crypto';

/**
 * Seeds the Smoke User on Production, or rotates its Session. ADR-0021.
 *
 *   node tools/seed-smoke-user.ts > smoke-user.sql
 *
 * Standard output is SQL, to run once against the production database -- in
 * Neon's SQL editor, or `psql "$DIRECT_URL" -f smoke-user.sql`. Standard error
 * is the Session's token, for `gh secret set SMOKE_SESSION_TOKEN`, and the day
 * it expires, for the repository variable `SMOKE_SESSION_EXPIRES_ON` that the
 * `Smoke token expiry` workflow reminds from. The token
 * appears nowhere else: the SQL carries only its hash, as the sessions table
 * does, so the file is not a credential.
 *
 * The script holds no database credential, which is the reason it prints SQL
 * rather than connecting: the owner runs it with the access they already have.
 *
 * Running it again is how the token is rotated. The User and its Entry are
 * inserted once and kept; the User's Sessions are replaced by one new Session,
 * so the old token signs nobody in from the moment the SQL commits. The Session
 * ends a year later and does not slide, because the User has no Identity, so
 * the smoke run fails on the day it ends rather than never.
 */

/** Fixed, so every run names the same User and the same Entry. */
const SMOKE_USER_ID = '01995d40-0000-7000-8000-000000000001';
const SMOKE_ENTRY_ID = '01995d40-0000-7000-8000-000000000002';

/** Hashed as `hashSessionToken` in `packages/core/src/auth/adapters` hashes one. */
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');

/**
 * A year from now, stated here rather than as `now()` in the SQL, so the day the
 * reminder counts to is the day the Session ends. The SQL runs a little after
 * this, so the Session ends a little after the day printed, never before.
 */
const expiresAt = new Date();
expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
const expiresOn = expiresAt.toISOString().slice(0, 10);

process.stdout.write(`begin;

insert into users (id, email, name, created_at)
values ('${SMOKE_USER_ID}', 'smoke@test.invalid', 'Smoke User', now())
on conflict (id) do nothing;

insert into entries (id, entry_date, memo, created_at, user_id)
values ('${SMOKE_ENTRY_ID}', '2026-09-18', 'Smoke run', now(), '${SMOKE_USER_ID}')
on conflict (id) do nothing;

insert into entry_lines (entry_id, line_number, account, side, amount)
values
  ('${SMOKE_ENTRY_ID}', 1, 'expense', 'debit', 100),
  ('${SMOKE_ENTRY_ID}', 2, 'cash', 'credit', 100)
on conflict (entry_id, line_number) do nothing;

delete from sessions where user_id = '${SMOKE_USER_ID}';

insert into sessions (token_hash, user_id, expires_at)
values ('${tokenHash}', '${SMOKE_USER_ID}', '${expiresAt.toISOString()}');

commit;
`);

process.stderr.write(
  `SMOKE_SESSION_TOKEN=${token}\n` +
    `SMOKE_SESSION_EXPIRES_ON=${expiresOn}\n` +
    'Run the SQL on Production first, then:\n' +
    '  gh secret set SMOKE_SESSION_TOKEN\n' +
    `  gh variable set SMOKE_SESSION_EXPIRES_ON --body ${expiresOn}\n`,
);
