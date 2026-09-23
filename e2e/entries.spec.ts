import { randomUUID } from 'node:crypto';
import { expect, test, type Locator } from '@playwright/test';
import { submitEntry, TWELVE_THOUSAND_FIVE_HUNDRED } from './entries';
import { signIn, signInForSmoke } from './session';

/**
 * Phase 1: create an entry, then list it. The model is ADR-0010.
 *
 * Every name a selector uses here, and in `entries.ts` beside it -- the form,
 * the fieldsets, the labels, the button, the section, the test ids -- is the
 * contract for `/entries`. Renaming one is a spec change (ADR-0002).
 *
 * The first two specs write, so they carry no `@smoke` tag and never run against
 * Production. They run in `E2E build`, beside each other and against
 * one database, and a retry writes again. So each entry is found by a memo no
 * other run can have written, never by counting or by position in the list.
 *
 * Every page here needs a Session (ADR-0021). Each spec signs in as a new User,
 * so it starts with books nobody else has written in.
 */

const DAY = '2026-09-15';

/**
 * Lines are asserted in the order they were entered, because `line_number`
 * keeps that order (ADR-0010). An account is matched by its code in any case,
 * so the list may show the code or a name that contains it.
 */
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

/**
 * 1. Create, then list
 *
 * Given a balanced entry with a date, a memo and two lines
 * When the visitor submits it on the entries page
 * Then it is listed there with its date, memo, lines and total, and it is still
 * listed after a reload
 *
 * The reload is what separates a stored entry from one the page only remembers.
 */
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

/**
 * 2. Refuse an unbalanced entry
 *
 * Given an entry whose debits and credits differ
 * When the visitor submits it
 * Then the page reports the imbalance and lists nothing new
 *
 * The message only has to mention the balance: its wording is copy, and this
 * pins what it is about rather than how it is put. "Nothing new" is checked
 * after a reload, once the list has visibly rendered, so an empty page cannot
 * satisfy it and neither can a list that has not caught up yet.
 */
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

/**
 * 3. The page answers
 *
 * Given the app is deployed
 * When a visitor opens the entries page
 * Then the form and the list of entries are rendered
 *
 * A read, so it is smoke-run against Production. Rendering the list queries
 * `entries`, so there it also shows that the production database carries the
 * migration. The list may be empty, so the section has to be visible
 * without any entry in it.
 *
 * Against Production it reads as the Smoke User; anywhere else, as a new User.
 */
test('renders the entry form and the list of entries', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto('/entries');

  await expect(page.getByRole('form', { name: 'New entry' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Entries' })).toBeVisible();
});

/**
 * 4. Books are the User's own
 *
 * Given one User has posted an entry
 * When a different User opens the entries page
 * Then that entry is not in their list
 *
 * "Not in the list" is checked once the list has visibly rendered, so an empty
 * page cannot satisfy it. ADR-0021.
 */
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
