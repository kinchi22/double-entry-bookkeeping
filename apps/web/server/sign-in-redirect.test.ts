import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';
import { orSignIn } from './sign-in-redirect';

async function thrownBy(call: Promise<unknown>): Promise<unknown> {
  try {
    await call;
  } catch (thrown) {
    return thrown;
  }
  expect.fail('the call was expected to throw');
}

const location = (thrown: unknown): string | undefined => {
  const digest: unknown = typeof thrown === 'object' && thrown !== null ? Reflect.get(thrown, 'digest') : undefined;
  return typeof digest === 'string' ? digest.split(';')[2] : undefined;
};

describe('orSignIn', () => {
  it('answers what the call answered', async () => {
    await expect(orSignIn(Promise.resolve(['entry']), '/entries')).resolves.toEqual(['entry']);
  });

  it('sends a visitor with no Session to sign in, remembering the page', async () => {
    const thrown = await thrownBy(
      orSignIn(Promise.reject(new TRPCError({ code: 'UNAUTHORIZED' })), '/entries'),
    );

    expect(location(thrown)).toBe('/sign-in?returnTo=%2Fentries');
  });

  it('rethrows any other refusal unchanged', async () => {
    const refusal = new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    expect(await thrownBy(orSignIn(Promise.reject(refusal), '/entries'))).toBe(refusal);
  });

  it('rethrows anything that is not a TRPCError unchanged', async () => {
    const defect = new Error('DATABASE_URL is not set.');

    expect(await thrownBy(orSignIn(Promise.reject(defect), '/entries'))).toBe(defect);
  });
});
