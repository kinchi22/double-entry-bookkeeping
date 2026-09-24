import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk, type DomainError, type Result, type UserId } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { type Session, type SessionTokenHash, type StoredSession } from '../domain/session';
import { type User } from '../domain/user';
import { createPostgresSessionRepository } from './postgres-session-repository';
import { createPostgresUserRepository } from './postgres-user-repository';

const databaseUrl = process.env['TEST_DATABASE_URL'];
if (databaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run integration tests with `pnpm test:integration`, ' +
      'which starts the Postgres container this suite needs.',
  );
}

const UNREACHABLE_URL = 'postgresql://absent:absent@127.0.0.1:1/absent';

const logged: LogFields[] = [];
const logger: Logger = {
  error: (fields) => {
    logged.push(fields);
  },
};

const repository = createPostgresSessionRepository(databaseUrl, logger);
const dead = createPostgresSessionRepository(UNREACHABLE_URL, logger);
const users = createPostgresUserRepository(databaseUrl, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), dead.close(), users.close(), close()]);
});

const ADA: User = {
  id: '01920000-0000-7000-8000-000000000001' as UserId,
  email: 'ada@example.com',
  name: 'Ada',
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
};
const SMOKE_USER_ID = '01920000-0000-7000-8000-00000000000a' as UserId;

beforeEach(async () => {
  await database.execute(sql`truncate table users cascade`);
  await users.add(ADA, { provider: 'google', subject: 'google-ada' });
  await database.execute(
    sql`insert into users (id, email, created_at) values (${SMOKE_USER_ID}, 'smoke@test.invalid', now())`,
  );
  logged.length = 0;
});

const session = (tokenHash: string, userId: UserId = ADA.id): Session => ({
  tokenHash: tokenHash as SessionTokenHash,
  userId,
  expiresAt: new Date('2026-10-18T09:30:00.123+09:00'),
});

async function found(tokenHash: string): Promise<StoredSession | undefined> {
  const result = await repository.find(tokenHash as SessionTokenHash);
  expect(isOk(result)).toBe(true);
  return isOk(result) ? result.value : undefined;
}

describe('createPostgresSessionRepository', () => {
  it('finds a Session by its hash, as it was added, sliding because its User has an Identity', async () => {
    expect(isOk(await repository.add(session('hash-1')))).toBe(true);

    expect(await found('hash-1')).toEqual({
      ...session('hash-1'),
      slides: true,
    });
    expect(logged).toEqual([]);
  });

  it('finds no Session by a hash nobody was issued', async () => {
    await repository.add(session('hash-1'));

    expect(await found('hash-2')).toBeUndefined();
  });

  it("does not slide the Session of a User with no Identity, the Smoke User's", async () => {
    await repository.add(session('smoke', SMOKE_USER_ID));

    expect(await found('smoke')).toEqual({
      ...session('smoke', SMOKE_USER_ID),
      slides: false,
    });
  });

  it('renews one Session, and only that one', async () => {
    await repository.add(session('hash-1'));
    await repository.add(session('hash-2'));
    const renewed = new Date('2026-11-01T00:00:00.000Z');

    expect(isOk(await repository.renew('hash-1' as SessionTokenHash, renewed))).toBe(true);

    expect((await found('hash-1'))?.expiresAt).toEqual(renewed);
    expect((await found('hash-2'))?.expiresAt).toEqual(session('hash-2').expiresAt);
  });

  it('removes one Session, and only that one', async () => {
    await repository.add(session('hash-1'));
    await repository.add(session('hash-2'));

    expect(isOk(await repository.remove('hash-1' as SessionTokenHash))).toBe(true);

    expect(await found('hash-1')).toBeUndefined();
    expect(await found('hash-2')).toBeDefined();
  });

  it('removes a Session that does not exist without complaint', async () => {
    expect(isOk(await repository.remove('hash-404' as SessionTokenHash))).toBe(true);
  });

  it('ends every Session of a User who is deleted', async () => {
    await repository.add(session('hash-1'));

    await database.execute(sql`delete from users where id = ${ADA.id}`);

    expect(await found('hash-1')).toBeUndefined();
  });

  it('reports an unreachable database as a result on every path, never by throwing', async () => {
    const hash = 'hash-1' as SessionTokenHash;
    const results: readonly Result<unknown, DomainError>[] = [
      await dead.add(session('hash-1')),
      await dead.find(hash),
      await dead.renew(hash, new Date()),
      await dead.remove(hash),
    ];

    for (const result of results) {
      expect(isErr(result) && result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    }
    expect(logged.map((fields) => fields.event)).toEqual([
      'auth.add_session_failed',
      'auth.find_session_failed',
      'auth.renew_session_failed',
      'auth.remove_session_failed',
    ]);
    expect(JSON.stringify(logged)).not.toContain('hash-1');
  });
});
