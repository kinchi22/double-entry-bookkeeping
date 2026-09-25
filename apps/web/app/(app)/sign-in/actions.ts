'use server';

import { TEST_SIGN_IN_FIELDS } from '@repo/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createContext } from '../../../server/context';
import { createCaller } from '../../../server/root-router';
import { returnPath } from '../../../server/return-path';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '../../../server/session-cookie';

export async function signInWithTestIdentifier(form: FormData): Promise<void> {
  const identifier = form.get(TEST_SIGN_IN_FIELDS.identifier);
  const caller = createCaller(await createContext());
  const session = await caller.auth.testSignIn({
    identifier: typeof identifier === 'string' ? identifier : '',
  });
  (await cookies()).set(SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
  redirect(returnPath(form.get(TEST_SIGN_IN_FIELDS.returnTo)));
}
