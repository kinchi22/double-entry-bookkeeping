import { TEST_SIGN_IN_FIELDS } from '@repo/contracts';
import { type ReactNode } from 'react';
import { en } from '../messages/en';

export type TestSignInFormProps = {
  /** Where the User goes once signed in, already checked to be this origin's. */
  readonly returnTo: string;
  /** The Server Action to submit to, passed in as `EntryForm` takes its own. */
  readonly action: (form: FormData) => Promise<void>;
};

const CONTROL = 'rounded border border-neutral-300 px-2 py-1';

/**
 * Signs in by an identifier alone. Rendered only where `AUTH_TEST_LOGIN` is
 * set, which is never Production (ADR-0021). The form's name, its field and its
 * button are what `e2e/session.ts` finds it by.
 */
export function TestSignInForm({ returnTo, action }: TestSignInFormProps): ReactNode {
  return (
    <form action={action} aria-label={en.testSignIn.title} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{en.testSignIn.title}</h2>
      <input type="hidden" name={TEST_SIGN_IN_FIELDS.returnTo} value={returnTo} />
      <label className="flex flex-col gap-1 text-sm">
        {en.testSignIn.identifier}
        <input name={TEST_SIGN_IN_FIELDS.identifier} required className={CONTROL} />
      </label>
      <button type="submit" className="self-start rounded border border-neutral-300 px-3 py-1 text-sm">
        {en.testSignIn.submit}
      </button>
    </form>
  );
}
