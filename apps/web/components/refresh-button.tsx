'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';

/**
 * A client component, and therefore a live test of the RSC boundary: if anyone
 * makes this file import @repo/core/server, the build fails.
 */
export function RefreshButton(): ReactNode {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      {isPending ? 'Checking...' : 'Re-check'}
    </button>
  );
}
