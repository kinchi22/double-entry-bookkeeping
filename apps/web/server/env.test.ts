import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

/**
 * The environment, parsed.
 *
 * `parseEnv` is a pure function over a record rather than a module that reads
 * `process.env` itself, for two reasons: a table of malformed inputs is the
 * only honest way to test it, and a module that read the environment as a side
 * effect of being imported would run during `next build`, where there is no
 * database URL and must not need to be one. `getContainer` is what supplies
 * `process.env`, at first use. See ADR-0005.
 *
 * The password is the reason for the last test in this file. A connection
 * string is a credential, and an error thrown here reaches a build log, a
 * server log, and in the worst case a browser. Nothing that describes a
 * rejected value may quote it.
 */

const VALID = 'postgres://app:hunter2@db.internal:5432/ledger';

/**
 * The URL the `E2E build` job in `.github/workflows/ci.yml` supplies:
 * syntactically a connection string, deliberately pointing at nothing. It is
 * asserted by name because the job depends on this function accepting it, and a
 * stricter rule added later would break that job rather than this test.
 */
const DELIBERATELY_DEAD = 'postgres://ci:ci@127.0.0.1:5433/ci';

describe('parseEnv', () => {
  it('returns the connection string exactly as it was given', () => {
    expect(parseEnv({ DATABASE_URL: VALID })).toEqual({ databaseUrl: VALID });
  });

  it('accepts both spellings of the scheme, because both reach the same driver', () => {
    const postgresql = 'postgresql://app@db.internal:5432/ledger';

    expect(parseEnv({ DATABASE_URL: postgresql })).toEqual({ databaseUrl: postgresql });
  });

  it('accepts the deliberately dead URL the E2E build job supplies', () => {
    expect(parseEnv({ DATABASE_URL: DELIBERATELY_DEAD })).toEqual({
      databaseUrl: DELIBERATELY_DEAD,
    });
  });

  it('ignores every other variable, so the shape is what this app reads and nothing else', () => {
    expect(parseEnv({ DATABASE_URL: VALID, PATH: '/usr/bin', VERCEL_ENV: 'production' })).toEqual({
      databaseUrl: VALID,
    });
  });

  /**
   * Each of these is a way a real deployment has gone wrong: the variable never
   * set, set to an empty string by a dashboard that stores one anyway, a bare
   * host and port with no scheme, or a value copied out of a tool that speaks a
   * different one.
   *
   * The expected message is part of the row, not a shared `/DATABASE_URL/`.
   * Both messages name the variable, so a single pattern matches either one and
   * stops distinguishing the two branches -- which is not a theory: written that
   * way, two mutants of the `undefined` check survived, one deleting the check
   * and one deleting its throw, because the value then failed the second check
   * and produced the other message.
   */
  const NOT_SET = /^DATABASE_URL is not set\./;
  const MALFORMED = /^DATABASE_URL is not a postgres/;

  const REJECTED: ReadonlyArray<
    readonly [string, Record<string, string | undefined>, RegExp]
  > = [
    ['the variable is absent', {}, NOT_SET],
    ['the variable is present and undefined', { DATABASE_URL: undefined }, NOT_SET],
    ['the value is empty', { DATABASE_URL: '' }, MALFORMED],
    ['the value is whitespace', { DATABASE_URL: '   ' }, MALFORMED],
    ['the value is not a URL', { DATABASE_URL: 'db.internal:5432/ledger' }, MALFORMED],
    ['the scheme is http', { DATABASE_URL: 'http://db.internal:5432/ledger' }, MALFORMED],
    [
      'the scheme is another database',
      { DATABASE_URL: 'mysql://app@db.internal:3306/ledger' },
      MALFORMED,
    ],
    ['there is no host', { DATABASE_URL: 'postgres:///ledger' }, MALFORMED],
    ['there is nothing but the scheme', { DATABASE_URL: 'postgres://' }, MALFORMED],
  ];

  it.each(REJECTED)('throws when %s', (_case, record, expected) => {
    expect(() => parseEnv(record)).toThrow(expected);
  });

  it('says what it wanted, because the message is all an operator gets', () => {
    expect(() => parseEnv({})).toThrow(/postgres:\/\/ or postgresql:\/\//);
  });

  it('never quotes the value, because a connection string carries a password', () => {
    const wrongScheme = 'http://app:hunter2@db.internal:5432/ledger';

    let message = '';
    try {
      parseEnv({ DATABASE_URL: wrongScheme });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain('hunter2');
    expect(message).not.toContain('db.internal');
  });
});
