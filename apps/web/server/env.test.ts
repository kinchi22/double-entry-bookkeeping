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
 * Syntactically a connection string, pointing at nothing: a host that is up and
 * a host that refuses are the same value to this function, because reachability
 * is not something a parser can know. Rejecting it would move that judgement
 * into validation, where it would fail a request the app is supposed to answer
 * with the probe's amber dot instead. ADR-0005.
 *
 * `E2E build` supplied exactly this URL until ADR-0012 gave that job a real
 * database. Nothing in CI depends on this case now; the rule it pins does.
 */
const DELIBERATELY_DEAD = 'postgres://ci:ci@127.0.0.1:5433/ci';

/** The Google client every valid environment carries. ADR-0021. */
const GOOGLE = {
  GOOGLE_CLIENT_ID: '1234-abc.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-hunter3',
} as const;

/** What `parseEnv` makes of a valid environment that names `databaseUrl`. */
const parsed = (databaseUrl: string): unknown => ({
  databaseUrl,
  google: { clientId: GOOGLE.GOOGLE_CLIENT_ID, clientSecret: GOOGLE.GOOGLE_CLIENT_SECRET },
  testSignIn: false,
});

describe('parseEnv', () => {
  it('returns the connection string exactly as it was given', () => {
    expect(parseEnv({ DATABASE_URL: VALID, ...GOOGLE })).toEqual(parsed(VALID));
  });

  it('accepts both spellings of the scheme, because both reach the same driver', () => {
    const postgresql = 'postgresql://app@db.internal:5432/ledger';

    expect(parseEnv({ DATABASE_URL: postgresql, ...GOOGLE })).toEqual(parsed(postgresql));
  });

  it('accepts a syntactically valid URL that points at nothing', () => {
    expect(parseEnv({ DATABASE_URL: DELIBERATELY_DEAD, ...GOOGLE })).toEqual(
      parsed(DELIBERATELY_DEAD),
    );
  });

  it('ignores every other variable, so the shape is what this app reads and nothing else', () => {
    expect(
      parseEnv({ DATABASE_URL: VALID, ...GOOGLE, PATH: '/usr/bin', VERCEL_ENV: 'production' }),
    ).toEqual(parsed(VALID));
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
    ['the variable is absent', { ...GOOGLE }, NOT_SET],
    ['the variable is present and undefined', { DATABASE_URL: undefined, ...GOOGLE }, NOT_SET],
    ['the value is empty', { DATABASE_URL: '', ...GOOGLE }, MALFORMED],
    ['the value is whitespace', { DATABASE_URL: '   ', ...GOOGLE }, MALFORMED],
    ['the value is not a URL', { DATABASE_URL: 'db.internal:5432/ledger', ...GOOGLE }, MALFORMED],
    ['the scheme is http', { DATABASE_URL: 'http://db.internal:5432/ledger', ...GOOGLE }, MALFORMED],
    [
      'the scheme is another database',
      { DATABASE_URL: 'mysql://app@db.internal:3306/ledger', ...GOOGLE },
      MALFORMED,
    ],
    ['there is no host', { DATABASE_URL: 'postgres:///ledger', ...GOOGLE }, MALFORMED],
    ['there is nothing but the scheme', { DATABASE_URL: 'postgres://', ...GOOGLE }, MALFORMED],
  ];

  it.each(REJECTED)('throws when %s', (_case, record, expected) => {
    expect(() => parseEnv(record)).toThrow(expected);
  });

  it('says what it wanted, because the message is all an operator gets', () => {
    expect(() => parseEnv({ ...GOOGLE })).toThrow(/postgres:\/\/ or postgresql:\/\//);
  });

  it('never quotes the value, because a connection string carries a password', () => {
    const wrongScheme = 'http://app:hunter2@db.internal:5432/ledger';

    let message = '';
    try {
      parseEnv({ DATABASE_URL: wrongScheme, ...GOOGLE });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain('hunter2');
    expect(message).not.toContain('db.internal');
  });

  it.each([
    ['GOOGLE_CLIENT_ID', 'absent', undefined, /^GOOGLE_CLIENT_ID is not set\.$/],
    ['GOOGLE_CLIENT_ID', 'empty', '', /^GOOGLE_CLIENT_ID is empty\.$/],
    ['GOOGLE_CLIENT_ID', 'whitespace', '  ', /^GOOGLE_CLIENT_ID is empty\.$/],
    ['GOOGLE_CLIENT_SECRET', 'absent', undefined, /^GOOGLE_CLIENT_SECRET is not set\.$/],
    ['GOOGLE_CLIENT_SECRET', 'empty', '', /^GOOGLE_CLIENT_SECRET is empty\.$/],
  ])('throws when %s is %s', (name, _case, value, expected) => {
    expect(() => parseEnv({ DATABASE_URL: VALID, ...GOOGLE, [name]: value })).toThrow(expected);
  });

  it('keeps the Google client exactly as it was given, and never quotes the secret', () => {
    expect(parseEnv({ DATABASE_URL: VALID, ...GOOGLE }).google).toEqual({
      clientId: '1234-abc.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-hunter3',
    });
    expect(() => parseEnv({ DATABASE_URL: VALID, GOOGLE_CLIENT_ID: 'id' })).toThrow(
      /^GOOGLE_CLIENT_SECRET is not set\.$/,
    );
  });
});

/**
 * The test sign-in signs anybody in by an identifier. What keeps it off
 * Production is this refusal and this test, not its absence (ADR-0021).
 */
describe('parseEnv, AUTH_TEST_LOGIN', () => {
  const env = { DATABASE_URL: VALID, ...GOOGLE };

  it('offers no test sign-in unless the variable is set', () => {
    expect(parseEnv(env).testSignIn).toBe(false);
    expect(parseEnv({ ...env, AUTH_TEST_LOGIN: '' }).testSignIn).toBe(false);
  });

  it.each(['preview', 'development', undefined])(
    'offers the test sign-in when it is set, on VERCEL_ENV %s',
    (vercelEnv) => {
      expect(parseEnv({ ...env, AUTH_TEST_LOGIN: '1', VERCEL_ENV: vercelEnv }).testSignIn).toBe(
        true,
      );
    },
  );

  it('refuses to run on Production with the test sign-in set', () => {
    expect(() => parseEnv({ ...env, AUTH_TEST_LOGIN: '1', VERCEL_ENV: 'production' })).toThrow(
      /^AUTH_TEST_LOGIN is set on Production, where the test sign-in must not exist\.$/,
    );
  });
});
