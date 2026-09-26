import { expect, type Locator, type Page } from '@playwright/test';

export const AMOUNT = '12500';

export const TWELVE_THOUSAND_FIVE_HUNDRED = /\b12,500\b/;

export const DAY = '2026-09-15';

export type TwoLineEntry = {
  readonly day: string;
  readonly memo: string;
  readonly debit: string;
  readonly credit: string;
  readonly amount: string;
};

export type Line = {
  readonly account: string;
  readonly side: 'debit' | 'credit';
  readonly amount: string;
};

export type MultiLineEntry = {
  readonly day: string;
  readonly memo: string;
  readonly lines: readonly Line[];
};

export const entryForm = (page: Page): Locator => page.getByRole('form', { name: 'New entry' });

export const lineGroup = (form: Locator, number: number): Locator =>
  form.getByRole('group', { name: `Line ${String(number)}`, exact: true });

export const lineGroups = (form: Locator): Locator =>
  form.getByRole('group', { name: /^Line \d+$/ });

export const listedEntry = (page: Page, memo: string): Locator =>
  page.getByTestId('entry').filter({ hasText: memo });

export async function submitTwoLineEntry(form: Locator, entry: TwoLineEntry): Promise<void> {
  await form.getByLabel('Date').fill(entry.day);
  await form.getByLabel('Memo').fill(entry.memo);
  await form.getByLabel('Debit account').selectOption(entry.debit);
  await form.getByLabel('Credit account').selectOption(entry.credit);
  await form.getByLabel('Amount').fill(entry.amount);

  await form.getByRole('button', { name: 'Add entry' }).click();
}

export async function fillLine(form: Locator, number: number, line: Line): Promise<void> {
  const group = lineGroup(form, number);
  await group.getByLabel('Account').selectOption(line.account);
  await group.getByLabel('Side').selectOption(line.side);
  await group.getByLabel('Amount').fill(line.amount);
}

export async function submitMultiLineEntry(form: Locator, entry: MultiLineEntry): Promise<void> {
  await form.getByLabel('Date').fill(entry.day);
  await form.getByLabel('Memo').fill(entry.memo);

  for (const [index, line] of entry.lines.entries()) {
    const number = index + 1;
    if (number > 2) {
      await form.getByRole('button', { name: 'Add line' }).click();
    }
    await fillLine(form, number, line);
  }

  await form.getByRole('button', { name: 'Add entry' }).click();
}

export async function postEntries(page: Page, entries: readonly TwoLineEntry[]): Promise<void> {
  for (const entry of entries) {
    await page.goto('/entries');
    await submitTwoLineEntry(entryForm(page), entry);
    await expect(listedEntry(page, entry.memo)).toHaveCount(1);
  }
}
