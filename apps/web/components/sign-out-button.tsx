import { type ReactNode } from 'react';
import { en } from '../messages/en';

export type SignOutButtonProps = {
  /** The Server Action that ends the Session, passed in as `RefreshButton` takes its own. */
  readonly action: () => Promise<void>;
};

export function SignOutButton({ action }: SignOutButtonProps): ReactNode {
  return (
    <form action={action}>
      <button type="submit" className="rounded border border-neutral-300 px-3 py-1 text-sm">
        {en.signOut.submit}
      </button>
    </form>
  );
}
