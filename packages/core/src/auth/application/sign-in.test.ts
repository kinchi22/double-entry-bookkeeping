import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type DomainError,
  type Err,
  type Result,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../domain/auth-context';
import {
  sessionExpiry,
  type Session,
  type SessionToken,
  type SessionTokenHash,
  type StoredSession,
} from '../domain/session';
import { type GoogleClaims, type Identity, type User } from '../domain/user';
import { type GoogleSignIn, type PendingSignIn } from '../ports/google-sign-in';
import { type SessionRepository } from '../ports/session-repository';
import { type UserRepository } from '../ports/user-repository';
import { createBeginGoogleSignIn } from './begin-google-sign-in';
import { createResolveSession } from './resolve-session';
import {
  createFinishGoogleSignIn,
  createTestSignIn,
  type IssuedSession,
  type SignInDependencies,
} from './sign-in';
import { createSignOut } from './sign-out';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-18T12:00:00.000Z');
const UNAVAILABLE = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

const identityKey = (identity: Identity): string => `${identity.provider}:${identity.subject}`;

type UserStore = UserRepository & {
  readonly users: Map<UserId, User>;
  readonly identities: Map<string, UserId>;
};

function inMemoryUsers(): UserStore {
  const users = new Map<UserId, User>();
  const identities = new Map<string, UserId>();
  return {
    users,
    identities,
    findByIdentity: (identity) => {
      const userId = identities.get(identityKey(identity));
      return Promise.resolve(ok(userId === undefined ? undefined : users.get(userId)));
    },
    add: (user, identity) => {
      if (identities.has(identityKey(identity))) {
        return Promise.resolve(err(domainError('CONFLICT', 'That Identity has a User.')));
      }
      users.set(user.id, user);
      identities.set(identityKey(identity), user.id);
      return Promise.resolve(ok(undefined));
    },
    updateProfile: (userId, profile) => {
      const user = users.get(userId);
      if (user !== undefined) {
        users.set(userId, { ...user, ...profile });
      }
      return Promise.resolve(ok(undefined));
    },
  };
}

type SessionStore = SessionRepository & {
  readonly rows: Map<SessionTokenHash, StoredSession>;
};

function inMemorySessions(): SessionStore {
  const rows = new Map<SessionTokenHash, StoredSession>();
  return {
    rows,
    add: (session: Session) => {
      rows.set(session.tokenHash, { ...session, slides: true });
      return Promise.resolve(ok(undefined));
    },
    find: (tokenHash) => Promise.resolve(ok(rows.get(tokenHash))),
    renew: (tokenHash, expiresAt) => {
      const row = rows.get(tokenHash);
      if (row !== undefined) {
        rows.set(tokenHash, { ...row, expiresAt });
      }
      return Promise.resolve(ok(undefined));
    },
    remove: (tokenHash) => {
      rows.delete(tokenHash);
      return Promise.resolve(ok(undefined));
    },
  };
}

const failing = (): Promise<Err<DomainError>> => Promise.resolve(err(UNAVAILABLE));

const hash = (token: string): SessionTokenHash => `sha256(${token})` as SessionTokenHash;

function google(claims: GoogleClaims): GoogleSignIn {
  return {
    begin: (redirectUri) =>
      Promise.resolve(
        ok({
          authorizationUrl: new URL(
            `https://accounts.google.test/auth?state=issued&redirect_uri=${encodeURIComponent(redirectUri.href)}`,
          ),
          pending: { state: 'issued', codeVerifier: 'verifier' },
        }),
      ),
    complete: (callbackUrl, pending) =>
      Promise.resolve(
        callbackUrl.searchParams.get('state') === pending.state
          ? ok(claims)
          : err(domainError('INVALID_INPUT', 'The state does not match.')),
      ),
  };
}

const ADA: GoogleClaims = { sub: 'google-ada', email: 'ada@example.com', name: 'Ada' };
const CALLBACK = new URL('https://app.test/auth/callback/google?state=issued&code=c');
const PENDING: PendingSignIn = { state: 'issued', codeVerifier: 'verifier' };

function world(overrides: Partial<SignInDependencies> = {}) {
  const users = inMemoryUsers();
  const sessions = inMemorySessions();
  let clock = NOW;
  let userCount = 0;
  let tokenCount = 0;
  const dependencies: SignInDependencies = {
    users,
    sessions,
    newUserId: () => {
      userCount += 1;
      return `01920000-0000-7000-8000-${String(userCount).padStart(12, '0')}` as UserId;
    },
    newSessionToken: () => {
      tokenCount += 1;
      return `token-${String(tokenCount)}` as SessionToken;
    },
    hashSessionToken: hash,
    now: () => clock,
    ...overrides,
  };
  const resolveDependencies = {
    sessions: dependencies.sessions,
    hashSessionToken: hash,
    now: () => clock,
  };
  return {
    users,
    sessions,
    advance: (milliseconds: number): void => {
      clock = new Date(clock.getTime() + milliseconds);
    },
    testSignIn: createTestSignIn(dependencies),
    finishGoogleSignIn: createFinishGoogleSignIn({ ...dependencies, google: google(ADA) }),
    resolveSession: createResolveSession(resolveDependencies),
    signOut: createSignOut(resolveDependencies),
  };
}

function issued(result: Result<IssuedSession, DomainError>): IssuedSession {
  expect(isOk(result), 'the sign-in was expected to succeed').toBe(true);
  return isOk(result) ? result.value : { token: '' as SessionToken, expiresAt: NOW };
}

async function whoIs(
  resolveSession: (token: string | undefined) => Promise<Result<AuthContext, DomainError>>,
  token: string | undefined,
): Promise<AuthContext> {
  const result = await resolveSession(token);
  expect(isOk(result), 'resolving the Session was expected to succeed').toBe(true);
  return isOk(result) ? result.value : SIGNED_OUT;
}

describe('createTestSignIn', () => {
  it('creates a User for a new identifier, and a Session that signs them in', async () => {
    const { testSignIn, resolveSession, users } = world();

    const session = issued(await testSignIn('e2e-1'));

    expect([...users.users.values()]).toEqual([
      {
        id: '01920000-0000-7000-8000-000000000001',
        email: 'e2e-1@test.invalid',
        name: null,
        createdAt: NOW,
      },
    ]);
    expect(await whoIs(resolveSession, session.token)).toEqual({
      userId: '01920000-0000-7000-8000-000000000001',
    });
  });

  it('issues a Session for 30 days, and stores only the hash of its token', async () => {
    const { testSignIn, sessions } = world();

    const session = issued(await testSignIn('e2e-1'));

    expect(session).toEqual({ token: 'token-1', expiresAt: sessionExpiry(NOW) });
    expect([...sessions.rows.keys()]).toEqual([hash('token-1')]);
  });

  it('signs the same identifier in as the same User, with a Session each time', async () => {
    const { testSignIn, resolveSession, users } = world();

    const first = issued(await testSignIn('e2e-1'));
    const second = issued(await testSignIn('e2e-1'));

    expect(users.users.size).toBe(1);
    expect(second.token).not.toBe(first.token);
    expect(await whoIs(resolveSession, second.token)).toEqual(
      await whoIs(resolveSession, first.token),
    );
  });

  it('signs different identifiers in as different Users', async () => {
    const { testSignIn, resolveSession } = world();

    const one = issued(await testSignIn('e2e-1'));
    const other = issued(await testSignIn('e2e-2'));

    expect(await whoIs(resolveSession, one.token)).not.toEqual(
      await whoIs(resolveSession, other.token),
    );
  });

  it('refuses a blank identifier, and creates nobody', async () => {
    const { testSignIn, users, sessions } = world();

    const result = await testSignIn('  ');

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
    expect(users.users.size).toBe(0);
    expect(sessions.rows.size).toBe(0);
  });

  it('passes a failure to find the User through, and begins no Session', async () => {
    const users = { ...inMemoryUsers(), findByIdentity: failing };
    const { testSignIn, sessions } = world({ users });

    const result = await testSignIn('e2e-1');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
    expect(sessions.rows.size).toBe(0);
  });

  it('passes a failure to add the User through, and begins no Session', async () => {
    const users = { ...inMemoryUsers(), add: failing };
    const { testSignIn, sessions } = world({ users });

    const result = await testSignIn('e2e-1');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
    expect(sessions.rows.size).toBe(0);
  });

  it('passes a failure to store the Session through', async () => {
    const sessions = { ...inMemorySessions(), add: failing };
    const { testSignIn } = world({ sessions });

    const result = await testSignIn('e2e-1');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});

describe('a first sign-in that races another', () => {
  const EARLIER: User = {
    id: '01920000-0000-7000-8000-0000000000ff' as UserId,
    email: 'e2e-1@test.invalid',
    name: null,
    createdAt: NOW,
  };

  function racedBy(
    earlier: User | undefined,
    findAgain?: UserRepository['findByIdentity'],
  ): UserStore {
    const store = inMemoryUsers();
    let finds = 0;
    return {
      ...store,
      findByIdentity: (identity) => {
        finds += 1;
        if (finds > 1 && findAgain !== undefined) {
          return findAgain(identity);
        }
        return finds === 1 ? Promise.resolve(ok(undefined)) : store.findByIdentity(identity);
      },
      add: async (_user, identity) => {
        if (earlier !== undefined) {
          await store.add(earlier, identity);
        }
        return err(domainError('CONFLICT', 'That Identity has a User.'));
      },
    };
  }

  it('signs in as the User the other sign-in added', async () => {
    const { testSignIn, resolveSession } = world({ users: racedBy(EARLIER) });

    const session = issued(await testSignIn('e2e-1'));

    expect(await whoIs(resolveSession, session.token)).toEqual({ userId: EARLIER.id });
  });

  it('reports the conflict when the User it lost to cannot be found', async () => {
    const { testSignIn } = world({ users: racedBy(undefined) });

    const result = await testSignIn('e2e-1');

    expect(isErr(result) && result.error.code).toBe('CONFLICT');
  });

  it('passes a failure to find the User again through', async () => {
    const { testSignIn } = world({ users: racedBy(EARLIER, failing) });

    const result = await testSignIn('e2e-1');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});

describe('createFinishGoogleSignIn', () => {
  it('creates a User from what Google vouches for, and signs them in', async () => {
    const { finishGoogleSignIn, resolveSession, users } = world();

    const session = issued(await finishGoogleSignIn(CALLBACK, PENDING));

    expect([...users.users.values()]).toEqual([
      {
        id: '01920000-0000-7000-8000-000000000001',
        email: 'ada@example.com',
        name: 'Ada',
        createdAt: NOW,
      },
    ]);
    expect([...users.identities.keys()]).toEqual(['google:google-ada']);
    expect(await whoIs(resolveSession, session.token)).toEqual({
      userId: '01920000-0000-7000-8000-000000000001',
    });
  });

  it('keeps what Google says at the latest sign-in', async () => {
    const { finishGoogleSignIn, users } = world();
    await finishGoogleSignIn(CALLBACK, PENDING);

    const renamed = createFinishGoogleSignIn({
      users,
      sessions: inMemorySessions(),
      newUserId: () => '01920000-0000-7000-8000-000000000009' as UserId,
      newSessionToken: () => 'token-9' as SessionToken,
      hashSessionToken: hash,
      now: () => NOW,
      google: google({ ...ADA, email: 'ada@lovelace.test', name: undefined }),
    });
    issued(await renamed(CALLBACK, PENDING));

    expect([...users.users.values()]).toEqual([
      {
        id: '01920000-0000-7000-8000-000000000001',
        email: 'ada@lovelace.test',
        name: null,
        createdAt: NOW,
      },
    ]);
  });

  it('passes a failure to keep the profile through, and begins no Session', async () => {
    const users = { ...inMemoryUsers(), updateProfile: failing };
    const { finishGoogleSignIn, sessions } = world({ users });
    issued(await finishGoogleSignIn(CALLBACK, PENDING));

    const result = await finishGoogleSignIn(CALLBACK, PENDING);

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
    expect(sessions.rows.size).toBe(1);
  });

  it('signs nobody in from a callback this browser never began', async () => {
    const { finishGoogleSignIn, users, sessions } = world();

    const result = await finishGoogleSignIn(CALLBACK, undefined);

    expect(isErr(result) && result.error).toEqual(
      domainError('INVALID_INPUT', 'No sign-in with Google was begun here.'),
    );
    expect(users.users.size).toBe(0);
    expect(sessions.rows.size).toBe(0);
  });

  it('signs nobody in when Google does not answer the pending sign-in', async () => {
    const { finishGoogleSignIn, users, sessions } = world();

    const result = await finishGoogleSignIn(CALLBACK, { ...PENDING, state: 'forged' });

    expect(isErr(result) && result.error).toEqual(
      domainError('INVALID_INPUT', 'The state does not match.'),
    );
    expect(users.users.size).toBe(0);
    expect(sessions.rows.size).toBe(0);
  });

  it('signs nobody in when Google gives no email address', async () => {
    const { users, sessions, ...rest } = world();
    const finish = createFinishGoogleSignIn({
      users,
      sessions,
      newUserId: () => '01920000-0000-7000-8000-000000000001' as UserId,
      newSessionToken: () => 'token-1' as SessionToken,
      hashSessionToken: hash,
      now: () => NOW,
      google: google({ ...ADA, email: undefined }),
    });

    const result = await finish(CALLBACK, PENDING);

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
    expect(users.users.size).toBe(0);
    expect(await whoIs(rest.resolveSession, 'token-1')).toEqual(SIGNED_OUT);
  });
});

describe('createBeginGoogleSignIn', () => {
  it("answers with Google's authorization URL and what the browser must bring back", async () => {
    const begin = createBeginGoogleSignIn({ google: google(ADA) });

    const result = await begin(new URL('https://app.test/auth/callback/google'));

    expect(isOk(result) && result.value).toEqual({
      authorizationUrl: new URL(
        'https://accounts.google.test/auth?state=issued&redirect_uri=https%3A%2F%2Fapp.test%2Fauth%2Fcallback%2Fgoogle',
      ),
      pending: PENDING,
    });
  });
});

describe('createResolveSession', () => {
  it.each([
    ['no cookie', undefined],
    ['an empty cookie', ''],
    ['a token the app never issued', 'token-404'],
  ])('signs nobody in with %s', async (_case, token) => {
    const { testSignIn, resolveSession } = world();
    issued(await testSignIn('e2e-1'));

    expect(await whoIs(resolveSession, token)).toEqual(SIGNED_OUT);
  });

  it.each([
    ['no cookie', undefined],
    ['an empty cookie', ''],
  ])('signs nobody in with %s without asking the Session store', async (_case, token) => {
    const sessions = { ...inMemorySessions(), find: failing };
    const resolveSession = createResolveSession({ sessions, hashSessionToken: hash, now: () => NOW });

    expect(await whoIs(resolveSession, token)).toEqual(SIGNED_OUT);
  });

  it('signs nobody in once the Session has ended', async () => {
    const { testSignIn, resolveSession, advance } = world();
    const session = issued(await testSignIn('e2e-1'));

    advance(30 * DAY);

    expect(await whoIs(resolveSession, session.token)).toEqual(SIGNED_OUT);
  });

  it('leaves a Session in the first half of its lifetime as it was', async () => {
    const { testSignIn, resolveSession, sessions, advance } = world();
    const session = issued(await testSignIn('e2e-1'));

    advance(10 * DAY);
    await whoIs(resolveSession, session.token);

    expect(sessions.rows.get(hash(session.token))?.expiresAt).toEqual(session.expiresAt);
  });

  it('renews a Session used in its second half, so it outlives its first expiry', async () => {
    const { testSignIn, resolveSession, sessions, advance } = world();
    const session = issued(await testSignIn('e2e-1'));
    const signedIn = await whoIs(resolveSession, session.token);

    advance(20 * DAY);
    expect(await whoIs(resolveSession, session.token)).toEqual(signedIn);
    expect(sessions.rows.get(hash(session.token))?.expiresAt).toEqual(
      new Date(NOW.getTime() + 50 * DAY),
    );

    advance(20 * DAY);
    expect(await whoIs(resolveSession, session.token)).toEqual(signedIn);
  });

  it("never renews a Session that does not slide, as the Smoke User's does not", async () => {
    const { resolveSession, sessions, advance } = world();
    const userId = '01920000-0000-7000-8000-00000000000a' as UserId;
    const expiresAt = new Date(NOW.getTime() + DAY);
    sessions.rows.set(hash('smoke'), { tokenHash: hash('smoke'), userId, expiresAt, slides: false });

    expect(await whoIs(resolveSession, 'smoke')).toEqual({ userId });
    expect(sessions.rows.get(hash('smoke'))?.expiresAt).toEqual(expiresAt);

    advance(DAY);
    expect(await whoIs(resolveSession, 'smoke')).toEqual(SIGNED_OUT);
  });

  it('reports a Session store that cannot answer, rather than signing nobody in', async () => {
    const sessions = { ...inMemorySessions(), find: failing };
    const resolveSession = createResolveSession({ sessions, hashSessionToken: hash, now: () => NOW });

    const result = await resolveSession('token-1');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });

  it('reports a renewal that could not be stored', async () => {
    const { testSignIn, sessions } = world();
    const session = issued(await testSignIn('e2e-1'));
    const resolveSession = createResolveSession({
      sessions: { ...sessions, renew: failing },
      hashSessionToken: hash,
      now: () => new Date(NOW.getTime() + 20 * DAY),
    });

    const result = await resolveSession(session.token);

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});

describe('createSignOut', () => {
  it('ends the Session at once, and only that one', async () => {
    const { testSignIn, resolveSession, signOut } = world();
    const here = issued(await testSignIn('e2e-1'));
    const elsewhere = issued(await testSignIn('e2e-1'));
    const signedIn = await whoIs(resolveSession, elsewhere.token);

    const result = await signOut(here.token);

    expect(isOk(result)).toBe(true);
    expect(await whoIs(resolveSession, here.token)).toEqual(SIGNED_OUT);
    expect(await whoIs(resolveSession, elsewhere.token)).toEqual(signedIn);
  });

  it.each([
    ['no cookie', undefined],
    ['an empty cookie', ''],
  ])('is already done with %s', async (_case, token) => {
    const { signOut } = world({ sessions: { ...inMemorySessions(), remove: failing } });

    expect(isOk(await signOut(token))).toBe(true);
  });

  it('reports a Session that could not be ended', async () => {
    const sessions = { ...inMemorySessions(), remove: failing };
    const signOut = createSignOut({ sessions, hashSessionToken: hash });

    const result = await signOut('token-1');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});
