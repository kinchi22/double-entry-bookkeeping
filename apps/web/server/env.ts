/**
 * Configuration read from the environment, and the only statement of its shape.
 *
 * Two properties of this file are load-bearing, and both are in ADR-0005.
 *
 * It is pure. `parseEnv` takes the record instead of reading `process.env`, so
 * it can be tested against a table of malformed inputs, and so that importing
 * it has no effect. `getContainer` passes `process.env` at first use.
 *
 * It does not import `server-only`. Every other module under
 * `apps/web/server/` does, directly or transitively, which is what makes them
 * unimportable from vitest; this file has to stay importable to be tested at
 * all. Nothing secret lives here -- it validates a value, it does not hold one.
 *
 * It uses no schema library. Each variable is one or two checks, and
 * expressing them as a `zod` object left a line -- joining the issues of a
 * schema that can only ever report one -- that no test could reach. ADR-0005
 * records the measurement.
 *
 * Validation is deliberately narrow. Being able to parse the URL is not being
 * able to reach the database: a host that refuses the connection is a runtime
 * condition the health probe reports as an amber dot, not a startup failure.
 * What is caught here is the class of mistake no probe can distinguish from an
 * outage -- an unset variable, an empty one, a value from a dashboard field
 * that was never filled in, a scheme belonging to another tool.
 */

/** Both spellings reach the same driver. `node-postgres` accepts either. */
const POSTGRES_PROTOCOLS: readonly string[] = ['postgres:', 'postgresql:'];

const REQUIREMENT = 'a postgres:// or postgresql:// connection string with a host';

/**
 * Neither message quotes the offending value. A connection string carries a
 * password, and this error reaches a build log and a server log.
 */
const NOT_SET = `DATABASE_URL is not set. It must be ${REQUIREMENT}.`;
const MALFORMED = `DATABASE_URL is not ${REQUIREMENT}.`;

function isPostgresConnectionString(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  // `postgres:///ledger` parses and names no host, which is a value that would
  // otherwise fail much later, inside the driver.
  return POSTGRES_PROTOCOLS.includes(url.protocol) && url.hostname !== '';
}

/**
 * A value that must be present and not blank, and that this file never quotes:
 * a client secret is a credential, like a connection string.
 */
function required(record: Record<string, string | undefined>, name: string): string {
  const value = record[name];
  if (value === undefined) throw new Error(`${name} is not set.`);
  if (value.trim() === '') throw new Error(`${name} is empty.`);
  return value;
}

export type Env = {
  readonly databaseUrl: string;
  /** The OAuth client Google knows this app by. ADR-0021. */
  readonly google: {
    readonly clientId: string;
    readonly clientSecret: string;
  };
  /**
   * Whether `/sign-in` offers the test sign-in, which signs in by an identifier
   * alone. Set for `E2E build` and Preview, where Google cannot redirect; never
   * on Production. ADR-0021.
   */
  readonly testSignIn: boolean;
};

/**
 * The test sign-in is a way into the app that exists in product code, and this
 * refusal is what keeps it off Production (ADR-0021). `VERCEL_ENV` is set by
 * Vercel on every deployment; it is read here and nowhere else.
 */
const TEST_SIGN_IN_ON_PRODUCTION =
  'AUTH_TEST_LOGIN is set on Production, where the test sign-in must not exist.';

/**
 * Throws, where the rest of this repository returns a `Result`.
 *
 * The error model in `docs/ARCHITECTURE.md` governs the domain, where a failure
 * is a value the caller decides about. There is no such caller here: an
 * environment this app cannot run in has no handler and no recovery, and a
 * `Result` would only be unwrapped and thrown one line later.
 */
export function parseEnv(record: Record<string, string | undefined>): Env {
  const databaseUrl = record['DATABASE_URL'];

  if (databaseUrl === undefined) throw new Error(NOT_SET);
  if (!isPostgresConnectionString(databaseUrl)) throw new Error(MALFORMED);

  const google = {
    clientId: required(record, 'GOOGLE_CLIENT_ID'),
    clientSecret: required(record, 'GOOGLE_CLIENT_SECRET'),
  };

  const testSignIn = (record['AUTH_TEST_LOGIN'] ?? '') !== '';
  if (testSignIn && record['VERCEL_ENV'] === 'production') {
    throw new Error(TEST_SIGN_IN_ON_PRODUCTION);
  }

  return { databaseUrl, google, testSignIn };
}
