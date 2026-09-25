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

export async function signOut(): Promise<void> {
  await createCaller(await createContext()).auth.signOut();
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/');
}
