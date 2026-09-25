import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk, type DomainError, type Result, type UserId } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { type Identity, type User } from '../domain/user';
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

const repository = createPostgresUserRepository(databaseUrl, logger);
const dead = createPostgresUserRepository(UNREACHABLE_URL, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), dead.close(), close()]);
});

beforeEach(async () => {
  await database.execute(sql`truncate table users cascade`);
  logged.length = 0;
});

const ADA: User = {
  id: '01920000-0000-7000-8000-000000000001' as UserId,
  email: 'ada@example.com',
  name: 'Ada',
  createdAt: new Date('2026-09-18T09:30:00.123+09:00'),
};
const GOOGLE_ADA: Identity = { provider: 'google', subject: 'google-ada' };

async function found(identity: Identity): Promise<User | undefined> {
  const result = await repository.findByIdentity(identity);
  expect(isOk(result)).toBe(true);
  return isOk(result) ? result.value : undefined;
}

async function countUsers(): Promise<number> {
  const result = await database.execute<{ count: number }>(
    sql`select count(*)::int as count from users`,
  );
  return result.rows[0]?.count ?? -1;
}

describe('createPostgresUserRepository', () => {
  it('finds a User by the Identity they were added with, as they were added', async () => {
    expect(isOk(await repository.add(ADA, GOOGLE_ADA))).toBe(true);

    expect(await found(GOOGLE_ADA)).toEqual(ADA);
    expect(logged).toEqual([]);
  });

  it('keeps a User with no name', async () => {
    const nameless = { ...ADA, name: null };
    await repository.add(nameless, GOOGLE_ADA);

    expect(await found(GOOGLE_ADA)).toEqual(nameless);
  });

  it('finds nobody by an Identity nobody has', async () => {
    await repository.add(ADA, GOOGLE_ADA);

    expect(await found({ provider: 'google', subject: 'google-grace' })).toBeUndefined();
  });

  it('keys an Identity by its provider too, so the same subject elsewhere is someone else', async () => {
    await repository.add(ADA, GOOGLE_ADA);

    expect(await found({ provider: 'test', subject: 'google-ada' })).toBeUndefined();
  });

  it('refuses an Identity that already has a User as a conflict, and stores nobody', async () => {
    await repository.add(ADA, GOOGLE_ADA);
    const second: User = {
      ...ADA,
      id: '01920000-0000-7000-8000-000000000002' as UserId,
    };

    const result = await repository.add(second, GOOGLE_ADA);

    expect(isErr(result) && result.error.code).toBe('CONFLICT');
    expect(await countUsers()).toBe(1);
    expect(await found(GOOGLE_ADA)).toEqual(ADA);
    expect(logged).toEqual([]);
  });

  it('records the email and name of the latest sign-in', async () => {
    await repository.add(ADA, GOOGLE_ADA);

    const result = await repository.updateProfile(ADA.id, {
      email: 'ada@lovelace.test',
      name: null,
    });

    expect(isOk(result)).toBe(true);
    expect(await found(GOOGLE_ADA)).toEqual({
      ...ADA,
      email: 'ada@lovelace.test',
      name: null,
    });
  });

  it('reports an unreachable database as a result on every path, never by throwing', async () => {
    const find = await dead.findByIdentity(GOOGLE_ADA);
    const add = await dead.add(ADA, GOOGLE_ADA);
    const update = await dead.updateProfile(ADA.id, {
      email: 'ada@example.com',
      name: null,
    });

    const results: readonly Result<unknown, DomainError>[] = [find, add, update];
    for (const result of results) {
      expect(isErr(result) && result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    }
    expect(logged.map((fields) => fields.event)).toEqual([
      'auth.find_user_failed',
      'auth.add_user_failed',
      'auth.update_profile_failed',
    ]);
    expect(logged.map((fields) => fields['error'])).toEqual([
      expect.objectContaining({ code: 'ECONNREFUSED' }),
      expect.objectContaining({ code: 'ECONNREFUSED' }),
      expect.objectContaining({ code: 'ECONNREFUSED' }),
    ]);
    expect(JSON.stringify(logged)).not.toContain('ada@example.com');
  });
});
