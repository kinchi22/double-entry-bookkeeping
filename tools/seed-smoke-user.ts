import { createHash, randomBytes } from 'node:crypto';

const SMOKE_USER_ID = '01995d40-0000-7000-8000-000000000001';
const SMOKE_ENTRY_ID = '01995d40-0000-7000-8000-000000000002';

const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');

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
