import { type LogFields, type Logger } from '@repo/core';
import { describe, expect, it } from 'vitest';
import { createOnRequestError, requestErrorFields } from './request-error';

const REQUEST = {
  path: '/entries?memo=Secret%20memo',
  method: 'POST',
  headers: { cookie: 'session=Secret' },
} as const;

const CONTEXT = {
  routerKind: 'App Router',
  routePath: '/entries',
  routeType: 'action',
  renderSource: 'react-server-components',
  revalidateReason: undefined,
} as const;

/** What Next hands the hook: an error carrying the digest it printed. */
const failure = (): Error =>
  Object.assign(new Error('The entries could not be read.'), { digest: '2417318741' });

describe('requestErrorFields', () => {
  it('names the route, the method, the digest and the error', () => {
    expect(requestErrorFields(failure(), REQUEST, CONTEXT)).toStrictEqual({
      event: 'request.failed',
      method: 'POST',
      routePath: '/entries',
      routeType: 'action',
      renderSource: 'react-server-components',
      digest: '2417318741',
      error: { name: 'Error', message: 'The entries could not be read.' },
    });
  });

  it('leaves out the headers and the query string', () => {
    expect(JSON.stringify(requestErrorFields(failure(), REQUEST, CONTEXT))).not.toContain('Secret');
  });

  it('has no digest when the error carries none, or one that is not a string', () => {
    const plain = requestErrorFields(new Error('boom'), REQUEST, CONTEXT);
    const numbered = requestErrorFields(
      Object.assign(new Error('boom'), { digest: 42 }),
      REQUEST,
      CONTEXT,
    );

    expect(plain).not.toHaveProperty('digest');
    expect(numbered).not.toHaveProperty('digest');
  });

  it.each([
    ['a string', 'Secret'],
    ['null', null],
  ])('describes %s that was thrown, with no digest', (_, thrown) => {
    const fields = requestErrorFields(thrown, REQUEST, CONTEXT);

    expect(fields).not.toHaveProperty('digest');
    expect(fields['error']).toEqual({
      name: typeof thrown,
      message: 'A value that is not an Error was thrown.',
    });
  });
});

describe('createOnRequestError', () => {
  it('logs one line per failed request, with a fixed message', async () => {
    const logged: { fields: LogFields; message: string }[] = [];
    const logger: Logger = {
      error: (fields, message) => {
        logged.push({ fields, message });
      },
    };

    await createOnRequestError(logger)(failure(), REQUEST, CONTEXT);

    expect(logged).toStrictEqual([
      {
        fields: requestErrorFields(failure(), REQUEST, CONTEXT),
        message: 'A request failed on the server.',
      },
    ]);
  });
});
