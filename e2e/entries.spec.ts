import { randomUUID } from 'node:crypto';
import { expect, test, type Locator } from '@playwright/test';
import {
  AMOUNT,
  DAY,
  entryForm,
  listedEntry,
  submitTwoLineEntry,
  TWELVE_THOUSAND_FIVE_HUNDRED,
} from './entries';
import { signIn, signInForSmoke } from './session';

async function expectListedAsSubmitted(entry: Locator): Promise<void> {
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(DAY);

  const lines = entry.getByTestId('entry-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText(/expense/i);
  await expect(lines.nth(0)).toContainText(/debit/i);
  await expect(lines.nth(0)).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(lines.nth(1)).toContainText(/cash/i);
  await expect(lines.nth(1)).toContainText(/credit/i);
  await expect(lines.nth(1)).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);

  await expect(entry.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
}

test('lists a Two-line mode entry as one debit and one credit line of its amount, and after a reload', async ({ page }) => {
  const memo = `Office supplies ${randomUUID()}`;
  await signIn(page);
  await page.goto('/entries');

  const form = entryForm(page);
  await expect(form).toBeVisible();

  await submitTwoLineEntry(form, { day: DAY, memo, debit: 'expense', credit: 'cash', amount: AMOUNT });

  const entry = listedEntry(page, memo);
  await expectListedAsSubmitted(entry);

  await page.reload();
  await expectListedAsSubmitted(entry);
});

test('renders the entry form and the list of entries', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto('/entries');

  await expect(entryForm(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Entries' })).toBeVisible();
});

test("does not show one User's entries to another", async ({ browser }) => {
  const memo = `Private ${randomUUID()}`;

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signIn(ownerPage);
  await submitTwoLineEntry(entryForm(ownerPage), {
    day: DAY,
    memo,
    debit: 'expense',
    credit: 'cash',
    amount: AMOUNT,
  });
  await expectListedAsSubmitted(listedEntry(ownerPage, memo));

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage);
  await expect(otherPage.getByRole('region', { name: 'Entries' })).toBeVisible();
  await expect(listedEntry(otherPage, memo)).toHaveCount(0);

  await owner.close();
  await other.close();
});
