import 'server-only';
import { domainError, entryIdSchema, err, userIdSchema } from '@repo/contracts';
import {
  createBeginGoogleSignIn,
  createFinishGoogleSignIn,
  createGetHealth,
  createListEntries,
  createPostEntry,
  createResolveSession,
  createSignOut,
  createTestSignIn,
  type BeginGoogleSignIn,
  type FinishGoogleSignIn,
  type GetHealth,
  type ListEntries,
  type PostEntry,
  type ResolveSession,
  type SignOut,
  type TestSignIn,
} from '@repo/core';
import {
  createOpenIdGoogleSignIn,
  createPostgresEntryRepository,
  createPostgresHealthProbe,
  createPostgresSessionRepository,
  createPostgresUserRepository,
  hashSessionToken,
  newSessionToken,
} from '@repo/core/server';
import { v7 as uuidv7 } from 'uuid';
import { type Env, parseEnv } from './env';
import { createLogger, stderr } from './logger';

/**
 * DI composition root.
 *
 * This is the only place in the repo allowed to choose a concrete
 * implementation. It is not exempt from anything: it used to be excused from
 * the dynamic-import ban because a person read it, and ADR-0002 reserved human
 * review for the specs and the applied migrations instead.
 *
 * Everything below this line is wiring. No business rules belong here.
 */
export type Container = {
  readonly getHealth: GetHealth;
  readonly postEntry: PostEntry;
  readonly listEntries: ListEntries;
  readonly resolveSession: ResolveSession;
  readonly beginGoogleSignIn: BeginGoogleSignIn;
  readonly finishGoogleSignIn: FinishGoogleSignIn;
  /** Whether `/sign-in` offers the test sign-in: `AUTH_TEST_LOGIN`. */
  readonly testSignInOffered: boolean;
  readonly testSignIn: TestSignIn;
  readonly signOut: SignOut;
};

/** Where there is no test sign-in, signing in by an identifier finds nothing. */
const noTestSignIn: TestSignIn = () =>
  Promise.resolve(err(domainError('NOT_FOUND', 'There is no test sign-in here.')));

export function createContainer({ databaseUrl, google, testSignIn }: Env): Container {
  const logger = createLogger(stderr());
  const postgres = createPostgresHealthProbe(databaseUrl, logger);
  const entries = createPostgresEntryRepository(databaseUrl, logger);
  const sessions = createPostgresSessionRepository(databaseUrl, logger);
  const signIn = {
    users: createPostgresUserRepository(databaseUrl, logger),
    sessions,
    newUserId: () => userIdSchema.parse(uuidv7()),
    newSessionToken,
    hashSessionToken,
    now: () => new Date(),
  };
  const googleSignIn = createOpenIdGoogleSignIn(google, logger);

  return {
    getHealth: createGetHealth({
      probes: [postgres],
      now: () => new Date(),
    }),
    postEntry: createPostEntry({
      entries,
      // Parsing brands the id, and would fail loudly if the generator ever
      // stopped producing v7.
      newEntryId: () => entryIdSchema.parse(uuidv7()),
      now: () => new Date(),
    }),
    listEntries: createListEntries({ entries }),
    resolveSession: createResolveSession({ sessions, hashSessionToken, now: () => new Date() }),
    beginGoogleSignIn: createBeginGoogleSignIn({ google: googleSignIn }),
    finishGoogleSignIn: createFinishGoogleSignIn({ ...signIn, google: googleSignIn }),
    testSignInOffered: testSignIn,
    testSignIn: testSignIn ? createTestSignIn(signIn) : noTestSignIn,
    signOut: createSignOut({ sessions, hashSessionToken }),
  };
}

let cached: Container | undefined;

/**
 * Reading configuration from the environment happens here and nowhere else.
 * Core receives configuration as arguments, which is what keeps it testable and
 * portable off Vercel.
 *
 * `parseEnv` is called here rather than at module scope on purpose. This module
 * is loaded while `next build` collects page data for
 * `apps/web/app/api/trpc/[trpc]/route.ts`, and that build runs in CI with no
 * database URL; a throw during import would fail it. Called from inside the
 * function, validation happens on the first request instead. ADR-0005.
 */
export function getContainer(): Container {
  cached ??= createContainer(parseEnv(process.env));
  return cached;
}
