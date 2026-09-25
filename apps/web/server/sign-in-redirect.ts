import { TRPCError } from '@trpc/server';
import { redirect } from 'next/navigation';
import { signInPath } from './return-path';

export async function orSignIn<T>(call: Promise<T>, from: string): Promise<T> {
  try {
    return await call;
  } catch (thrown) {
    if (thrown instanceof TRPCError && thrown.code === 'UNAUTHORIZED') {
      redirect(signInPath(from));
    }
    throw thrown;
  }
}
