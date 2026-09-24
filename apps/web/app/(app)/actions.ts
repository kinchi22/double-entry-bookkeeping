'use server';

import { revalidatePath } from 'next/cache';

export async function recheckHealth(): Promise<void> {
  revalidatePath('/');
}
