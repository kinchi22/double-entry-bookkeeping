import { expect, type Locator, type Page } from '@playwright/test';

/**
 * How a spec writes an Entry: through the form on `/entries`, the way a User
 * does. There is no other way in -- posting is a Server Action, on the write
 * path -- and there is one implementation of it here rather than one per spec
 * file, for the same reason `session.ts` holds one way to sign in.
 *
 * The form's name, its fieldsets, its labels and its button are the contract
 * for `/entries`. Renaming one is a spec change (ADR-0002).
 */

/** A line as the form takes it: an account code, a side, and plain digits. */
export type Line = {
  readonly account: string;
  readonly side: 'debit' | 'credit';
  readonly amount: string;
};

/** An entry as the form takes it: a day, a memo, and the lines that balance. */
export type NewEntry = {
  readonly day: string;
  readonly memo: string;
  readonly lines: readonly [Line, Line];
};

/** Fills the entry form and submits it. The caller decides how it got there. */
export async function submitEntry(form: Locator, entry: NewEntry): Promise<void> {
  await form.getByLabel('Date').fill(entry.day);
  await form.getByLabel('Memo').fill(entry.memo);

  for (const [index, line] of entry.lines.entries()) {
    const group = form.getByRole('group', { name: `Line ${String(index + 1)}` });
    await group.getByLabel('Account').selectOption(line.account);
    await group.getByLabel('Side').selectOption(line.side);
    await group.getByLabel('Amount').fill(line.amount);
  }

  await form.getByRole('button', { name: 'Add entry' }).click();
}

/**
 * Posts each entry from `/entries`, waiting for each to be listed before the
 * next is typed. A spec that then searches for what it wrote needs the write
 * to have happened, and the list is where that becomes visible. Each entry is
 * found by its memo, never by counting or by position.
 */
export async function postEntries(page: Page, entries: readonly NewEntry[]): Promise<void> {
  for (const entry of entries) {
    await page.goto('/entries');
    await submitEntry(page.getByRole('form', { name: 'New entry' }), entry);
    await expect(page.getByTestId('entry').filter({ hasText: entry.memo })).toHaveCount(1);
  }
}
