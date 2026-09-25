import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { allowInsecureRequests } from 'openid-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk } from '@repo/contracts';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { type PendingSignIn } from '../ports/google-sign-in';
import { createOpenIdGoogleSignIn } from './openid-google-sign-in';

const CLIENT_ID = 'client-id';
const CLIENT_SECRET = 'client-secret';
const REDIRECT_URI = new URL('http://127.0.0.1/auth/callback/google');
const CODE = 'the-code';

const signingKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const strangerKey = generateKeyPairSync('rsa', { modulusLength: 2048 });

let answer: {
  readonly key: KeyObject;
  readonly claims: Record<string, unknown>;
  readonly status: number;
};
let challenge = '';

const logged: LogFields[] = [];
const logger: Logger = {
  error: (fields) => {
    logged.push(fields);
  },
};

let server: Server;
let issuer: URL;

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

function idToken(key: KeyObject, claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', kid: 'key-1', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), key);
  return `${header}.${payload}.${base64url(signature)}`;
}

async function body(request: IncomingMessage): Promise<URLSearchParams> {
  let text = '';
  for await (const chunk of request) {
    text += String(chunk);
  }
  return new URLSearchParams(text);
}

function provider(): Server {
  return createServer((request, response) => {
    const reply = (status: number, json: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(json));
    };
    const origin = issuer.href.replace(/\/$/, '');
    if (request.url === '/.well-known/openid-configuration') {
      reply(200, {
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        jwks_uri: `${origin}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
      });
      return;
    }
    if (request.url === '/jwks') {
      const jwk = signingKey.publicKey.export({ format: 'jwk' });
      reply(200, {
        keys: [{ ...jwk, kid: 'key-1', alg: 'RS256', use: 'sig' }],
      });
      return;
    }
    if (request.url === '/token') {
      void body(request).then((form) => {
        const verifier = form.get('code_verifier') ?? '';
        const verified = createHash('sha256').update(verifier).digest('base64url') === challenge;
        if (form.get('code') !== CODE || !verified || answer.status !== 200) {
          reply(400, { error: 'invalid_grant' });
          return;
        }
        reply(200, {
          access_token: 'access',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: idToken(answer.key, answer.claims),
        });
      });
      return;
    }
    reply(404, {});
  });
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: issuer.href.replace(/\/$/, ''),
    aud: CLIENT_ID,
    sub: 'google-ada',
    email: 'ada@example.com',
    name: 'Ada',
    iat: now,
    exp: now + 300,
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-deprecated -- openid-client names a test issuer on 127.0.0.1 as the use of this switch
const OVER_HTTP = { execute: [allowInsecureRequests] };

const googleSignIn = (): ReturnType<typeof createOpenIdGoogleSignIn> =>
  createOpenIdGoogleSignIn(
    {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      issuer,
      discovery: OVER_HTTP,
    },
    logger,
  );

async function beginAndReturn(state?: string): Promise<{
  pending: PendingSignIn;
  callbackUrl: URL;
  authorizationUrl: URL;
}> {
  const adapter = googleSignIn();
  const begun = await adapter.begin(REDIRECT_URI);
  expect(isOk(begun), 'beginning the sign-in was expected to succeed').toBe(true);
  if (!isOk(begun)) throw new Error('unreachable');
  const { authorizationUrl, pending } = begun.value;
  challenge = authorizationUrl.searchParams.get('code_challenge') ?? '';
  const callbackUrl = new URL(REDIRECT_URI);
  callbackUrl.searchParams.set('code', CODE);
  callbackUrl.searchParams.set('state', state ?? pending.state);
  return { pending, callbackUrl, authorizationUrl };
}

beforeAll(async () => {
  server = provider();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = new URL(`http://127.0.0.1:${String((server.address() as AddressInfo).port)}`);
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  answer = { key: signingKey.privateKey, claims: claims(), status: 200 };
  logged.length = 0;
});

describe('createOpenIdGoogleSignIn', () => {
  it('sends the browser to the provider with PKCE, a state, and the scopes it needs', async () => {
    const { authorizationUrl, pending } = await beginAndReturn();

    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe(`${issuer.origin}/authorize`);
    expect(Object.fromEntries(authorizationUrl.searchParams)).toEqual({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI.href,
      scope: 'openid email profile',
      code_challenge: createHash('sha256').update(pending.codeVerifier).digest('base64url'),
      code_challenge_method: 'S256',
      state: pending.state,
    });
  });

  it('begins every sign-in with a state and a verifier of its own', async () => {
    const first = await beginAndReturn();
    const second = await beginAndReturn();

    expect(second.pending.state).not.toBe(first.pending.state);
    expect(second.pending.codeVerifier).not.toBe(first.pending.codeVerifier);
  });

  it('answers with the person the verified ID token names', async () => {
    const { pending, callbackUrl } = await beginAndReturn();

    const result = await googleSignIn().complete(callbackUrl, pending);

    expect(isOk(result) && result.value).toEqual({
      sub: 'google-ada',
      email: 'ada@example.com',
      name: 'Ada',
    });
    expect(logged).toEqual([]);
  });

  it('leaves out an email or a name the token does not carry as text', async () => {
    answer = { ...answer, claims: claims({ email: undefined, name: 42 }) };
    const { pending, callbackUrl } = await beginAndReturn();

    const result = await googleSignIn().complete(callbackUrl, pending);

    expect(isOk(result) && result.value).toEqual({
      sub: 'google-ada',
      email: undefined,
      name: undefined,
    });
  });

  it('refuses a callback whose state is not the one it was sent with', async () => {
    const { pending, callbackUrl } = await beginAndReturn('forged');

    const result = await googleSignIn().complete(callbackUrl, pending);

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
    expect(logged.map((fields) => fields.event)).toEqual(['auth.google_sign_in_refused']);
  });

  it('refuses a callback that says the person declined', async () => {
    const { pending, callbackUrl } = await beginAndReturn();
    callbackUrl.searchParams.delete('code');
    callbackUrl.searchParams.set('error', 'access_denied');

    const result = await googleSignIn().complete(callbackUrl, pending);

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
    expect(logged.map((fields) => fields.event)).toEqual(['auth.google_sign_in_refused']);
  });

  it('refuses when the verifier is not the one the challenge was made from', async () => {
    const { pending, callbackUrl } = await beginAndReturn();

    const result = await googleSignIn().complete(callbackUrl, {
      ...pending,
      codeVerifier: 'x'.repeat(43),
    });

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
  });

  const TOKENS: readonly (readonly [
    string,
    { key?: KeyObject; claims?: Record<string, unknown> },
  ])[] = [
    ['signed by a key the provider does not publish', { key: strangerKey.privateKey }],
    ['issued for another client', { claims: { aud: 'someone-else' } }],
    ['issued by another provider', { claims: { iss: 'https://accounts.example.com' } }],
    ['already expired', { claims: { exp: Math.floor(Date.now() / 1000) - 600 } }],
  ];

  it.each(TOKENS)('refuses an ID token %s', async (_case, change) => {
    answer = {
      ...answer,
      key: change.key ?? answer.key,
      claims: { ...answer.claims, ...change.claims },
    };
    const { pending, callbackUrl } = await beginAndReturn();

    const result = await googleSignIn().complete(callbackUrl, pending);

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
  });

  it('reports a provider it cannot reach as unavailable, and tries again next time', async () => {
    const unreachable = createOpenIdGoogleSignIn(
      {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        issuer: new URL('http://127.0.0.1:1'),
        discovery: OVER_HTTP,
      },
      logger,
    );

    const first = await unreachable.begin(REDIRECT_URI);
    const second = await unreachable.complete(REDIRECT_URI, {
      state: 's',
      codeVerifier: 'v',
    });

    expect(isErr(first) && first.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(second) && second.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged.map((fields) => fields.event)).toEqual([
      'auth.google_discovery_failed',
      'auth.google_discovery_failed',
    ]);
  });
});
