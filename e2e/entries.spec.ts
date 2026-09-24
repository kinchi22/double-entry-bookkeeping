import { randomUUID } from 'node:crypto';
import { expect, test, type Locator } from '@playwright/test';
import { submitEntry, TWELVE_THOUSAND_FIVE_HUNDRED } from './entries';
import { signIn, signInForSmoke } from './session';

const DAY = '2026-09-15';

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

test('lists a balanced entry once it is submitted, and after a reload', async ({ page }) => {
  const memo = `Office supplies ${randomUUID()}`;
  await signIn(page);
  await page.goto('/entries');

  const form = page.getByRole('form', { name: 'New entry' });
  await expect(form).toBeVisible();

  await submitEntry(form, {
    day: DAY,
    memo,
    lines: [
      { account: 'expense', side: 'debit', amount: '12500' },
      { account: 'cash', side: 'credit', amount: '12500' },
    ],
  });

  const entry = page.getByTestId('entry').filter({ hasText: memo });
  await expectListedAsSubmitted(entry);

  await page.reload();
  await expectListedAsSubmitted(entry);
});

test('refuses an entry whose debits and credits differ', async ({ page }) => {
  const memo = `Unbalanced ${randomUUID()}`;
  await signIn(page);
  await page.goto('/entries');

  const form = page.getByRole('form', { name: 'New entry' });
  await expect(form).toBeVisible();

  await submitEntry(form, {
    day: DAY,
    memo,
    lines: [
      { account: 'expense', side: 'debit', amount: '12500' },
      { account: 'cash', side: 'credit', amount: '12000' },
    ],
  });

  await expect(form.getByRole('alert')).toContainText(/balance/i);

  await page.reload();
  await expect(page.getByRole('region', { name: 'Entries' })).toBeVisible();
  await expect(page.getByTestId('entry').filter({ hasText: memo })).toHaveCount(0);
});

test('renders the entry form and the list of entries', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto('/entries');

  await expect(page.getByRole('form', { name: 'New entry' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Entries' })).toBeVisible();
});

test("does not show one User's entries to another", async ({ browser }) => {
  const memo = `Private ${randomUUID()}`;

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signIn(ownerPage);
  await submitEntry(ownerPage.getByRole('form', { name: 'New entry' }), {
    day: DAY,
    memo,
    lines: [
      { account: 'expense', side: 'debit', amount: '12500' },
      { account: 'cash', side: 'credit', amount: '12500' },
    ],
  });
  await expectListedAsSubmitted(ownerPage.getByTestId('entry').filter({ hasText: memo }));

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage);
  await expect(otherPage.getByRole('region', { name: 'Entries' })).toBeVisible();
  await expect(otherPage.getByTestId('entry').filter({ hasText: memo })).toHaveCount(0);

  await owner.close();
  await other.close();
});
