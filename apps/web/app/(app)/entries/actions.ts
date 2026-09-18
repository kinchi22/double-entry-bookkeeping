'use server';

import { parseEntryForm } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type EntryFormState } from '../../../components/entry-form';
import { createContext } from '../../../server/context';
import { fromTrpcError } from '../../../server/domain-error';
import { createCaller } from '../../../server/root-router';
import { SESSION_COOKIE } from '../../../server/session-cookie';

/**
 * Parses the form, posts the entry through `createCaller`, and maps the answer
 * onto what the form shows. See the "Client writes" row in
 * docs/ARCHITECTURE.md.
 *
 * A refusal is a state the form renders, not an exception: an imbalance is an
 * ordinary answer. Anything that is not a domain failure is rethrown by
 * `fromTrpcError`, so a defect still reaches the error boundary.
 */
export async function postEntry(
  _previous: EntryFormState,
  form: FormData,
): Promise<EntryFormState> {
  const input = parseEntryForm(form);
  if (!input.ok) {
    return { outcome: 'rejected', code: input.error.code };
  }

  try {
    await createCaller(await createContext()).entries.post(input.value);
  } catch (thrown) {
    return { outcome: 'rejected', code: fromTrpcError(thrown).code };
  }

  revalidatePath('/entries');
  return { outcome: 'saved' };
}

/**
 * Ends the Session through `createCaller`, so its token signs nobody in again,
 * forgets the cookie, and leaves for the home page. ADR-0021.
 */
export async function signOut(): Promise<void> {
  await createCaller(await createContext()).auth.signOut();
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/');
}
