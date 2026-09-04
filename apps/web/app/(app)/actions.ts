'use server';

import { revalidatePath } from 'next/cache';

/**
 * Server Actions are how this app writes. See the "Client writes" row in
 * docs/ARCHITECTURE.md.
 *
 * An action does the same three things a tRPC procedure does -- parse input,
 * invoke a use case through `createCaller`, map the response -- and then
 * invalidates whatever the change made stale. The same lint rule caps its size,
 * so logic cannot accumulate here either.
 *
 * This one has no input and no use case of its own: re-running the probes is
 * exactly what rendering the page does, so discarding the cached render is the
 * whole operation. Phase 1 adds the first action that carries a payload.
 */
export async function recheckHealth(): Promise<void> {
  revalidatePath('/');
}
