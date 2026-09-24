import { expect, type Locator, type Page } from '@playwright/test';

export const AMOUNT = '12500';

export const TWELVE_THOUSAND_FIVE_HUNDRED = /\b12,500\b/;

export type Line = {
  readonly account: string;
  readonly side: 'debit' | 'credit';
  readonly amount: string;
};

export type NewEntry = {
  readonly day: string;
  readonly memo: string;
  readonly lines: readonly [Line, Line];
};

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

export async function postEntries(page: Page, entries: readonly NewEntry[]): Promise<void> {
  for (const entry of entries) {
    await page.goto('/entries');
    await submitEntry(page.getByRole('form', { name: 'New entry' }), entry);
    await expect(page.getByTestId('entry').filter({ hasText: entry.memo })).toHaveCount(1);
  }
}
