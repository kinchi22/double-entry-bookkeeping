import { expect, type Locator, type Page } from '@playwright/test';
import { setEntryFormMode } from './settings';

export const AMOUNT = '12500';

export const amountShown = (formatted: string): RegExp =>
  new RegExp(`(?<![\\d,.-])${formatted}(?![\\d,.])`);

export const TWELVE_THOUSAND_FIVE_HUNDRED = amountShown('12,500');

export const DAY = '2026-09-15';

type Heading = {
  readonly day: string;
  readonly memo: string;
};

export type TwoLineEntry = Heading & {
  readonly debitAccount: string;
  readonly creditAccount: string;
  readonly amount: string;
};

export type Line = {
  readonly account: string;
  readonly side: 'debit' | 'credit';
  readonly amount: string;
};

export type MultiLineEntry = Heading & {
  readonly lines: readonly Line[];
};

export const entryForm = (page: Page): Locator => page.getByRole('form', { name: 'New entry' });

export const entrySearchForm = (page: Page): Locator =>
  page.getByRole('form', { name: 'Search entries' });

export const lineGroup = (form: Locator, position: number): Locator =>
  form.getByRole('group', { name: `Line ${String(position)}`, exact: true });

export const lineGroups = (form: Locator): Locator =>
  form.getByRole('group', { name: /^Line \d+$/ });

export const listedEntry = (page: Page, memo: string): Locator =>
  page.getByTestId('entry').filter({ hasText: memo });

async function fillHeading(form: Locator, heading: Heading): Promise<void> {
  await form.getByLabel('Date').fill(heading.day);
  await form.getByLabel('Memo').fill(heading.memo);
}

async function submit(form: Locator): Promise<void> {
  await form.getByRole('button', { name: 'Add entry' }).click();
}

export async function submitTwoLineEntry(form: Locator, entry: TwoLineEntry): Promise<void> {
  await fillHeading(form, entry);
  await form.getByLabel('Debit account').selectOption(entry.debitAccount);
  await form.getByLabel('Credit account').selectOption(entry.creditAccount);
  await form.getByLabel('Amount').fill(entry.amount);
  await submit(form);
}

export async function fillLine(form: Locator, position: number, line: Line): Promise<void> {
  const group = lineGroup(form, position);
  await group.getByLabel('Account').selectOption(line.account);
  await group.getByLabel('Side').selectOption(line.side);
  await group.getByLabel('Amount').fill(line.amount);
}

export async function submitMultiLineEntry(form: Locator, entry: MultiLineEntry): Promise<void> {
  await fillHeading(form, entry);

  for (const [index, line] of entry.lines.entries()) {
    const position = index + 1;
    if (position > 2) {
      await form.getByRole('button', { name: 'Add line' }).click();
    }
    await fillLine(form, position, line);
  }

  await submit(form);
}

export async function postEntries(page: Page, entries: readonly TwoLineEntry[]): Promise<void> {
  await setEntryFormMode(page, 'Two-line mode');
  for (const entry of entries) {
    await page.goto('/entries');
    await submitTwoLineEntry(entryForm(page), entry);
    await expect(listedEntry(page, entry.memo)).toHaveCount(1);
  }
}
