import 'server-only';
import { domainError, entryIdSchema, err, userIdSchema } from '@repo/contracts';
import {
  createBeginGoogleSignIn,
  createFinishGoogleSignIn,
  createGetHealth,
  createPostEntry,
  createResolveSession,
  createSearchEntries,
  createSignOut,
  createTestSignIn,
  type BeginGoogleSignIn,
  type FinishGoogleSignIn,
  type GetHealth,
  type PostEntry,
  type ResolveSession,
  type SearchEntries,
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

export type Container = {
  readonly getHealth: GetHealth;
  readonly postEntry: PostEntry;
  readonly searchEntries: SearchEntries;
  readonly resolveSession: ResolveSession;
  readonly beginGoogleSignIn: BeginGoogleSignIn;
  readonly finishGoogleSignIn: FinishGoogleSignIn;
  readonly testSignInOffered: boolean;
  readonly testSignIn: TestSignIn;
  readonly signOut: SignOut;
};

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
      newEntryId: () => entryIdSchema.parse(uuidv7()),
      now: () => new Date(),
    }),
    searchEntries: createSearchEntries({ entries }),
    resolveSession: createResolveSession({ sessions, hashSessionToken, now: () => new Date() }),
    beginGoogleSignIn: createBeginGoogleSignIn({ google: googleSignIn }),
    finishGoogleSignIn: createFinishGoogleSignIn({ ...signIn, google: googleSignIn }),
    testSignInOffered: testSignIn,
    testSignIn: testSignIn ? createTestSignIn(signIn) : noTestSignIn,
    signOut: createSignOut({ sessions, hashSessionToken }),
  };
}

let cached: Container | undefined;

export function getContainer(): Container {
  cached ??= createContainer(parseEnv(process.env));
  return cached;
}
