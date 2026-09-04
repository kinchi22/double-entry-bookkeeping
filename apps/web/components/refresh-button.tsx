'use client';

import { useFormStatus } from 'react-dom';
import { type ReactNode } from 'react';

export type RefreshButtonProps = {
  /**
   * The Server Action to run. Passed in rather than imported, so this component
   * stays a button and does not learn what it is refreshing.
   */
  readonly action: () => Promise<void>;
};

/**
 * `useFormStatus` reports the state of the nearest enclosing form, so it has to
 * live in a child of that form rather than in the component that renders it.
 */
function SubmitButton(): ReactNode {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
      disabled={pending}
    >
      {pending ? 'Checking...' : 'Re-check'}
    </button>
  );
}

/**
 * A client component, and therefore a live test of the RSC boundary: if anyone
 * makes this file import @repo/core/server, the build fails.
 */
export function RefreshButton({ action }: RefreshButtonProps): ReactNode {
  return (
    <form action={action}>
      <SubmitButton />
    </form>
  );
}
