import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  amountShown,
  DAY,
  entryForm,
  fillLine,
  lineGroup,
  lineGroups,
  listedEntry,
  submitMultiLineEntry,
  TWELVE_THOUSAND_FIVE_HUNDRED,
} from './entries';
import { signIn } from './session';
import { setEntryFormMode } from './settings';

async function openMultiLineForm(page: Page): Promise<Locator> {
  await signIn(page);
  await setEntryFormMode(page, 'Multi-line mode');
  await page.goto('/entries');
  const form = entryForm(page);
  await expect(lineGroup(form, 1)).toBeVisible();
  return form;
}

const enabledRemoveButtons = (form: Locator): Locator =>
  form.getByRole('button', { name: 'Remove line', disabled: false });

test('starts with two lines, adds a line, removes any line, and never goes below two', async ({ page }) => {
  const form = await openMultiLineForm(page);

  await expect(lineGroups(form)).toHaveCount(2);
  await expect(enabledRemoveButtons(form)).toHaveCount(0);

  await form.getByRole('button', { name: 'Add line' }).click();
  await expect(lineGroups(form)).toHaveCount(3);
  await expect(lineGroup(form, 3)).toBeVisible();
  await expect(enabledRemoveButtons(form)).toHaveCount(3);

  await fillLine(form, 1, { account: 'expense', side: 'debit', amount: '100' });
  await fillLine(form, 2, { account: 'cash', side: 'credit', amount: '200' });
  await fillLine(form, 3, { account: 'payable', side: 'credit', amount: '300' });

  await lineGroup(form, 1).getByRole('button', { name: 'Remove line' }).click();

  await expect(lineGroups(form)).toHaveCount(2);
  await expect(lineGroup(form, 1).getByLabel('Account')).toHaveValue('cash');
  await expect(lineGroup(form, 1).getByLabel('Amount')).toHaveValue('200');
  await expect(lineGroup(form, 2).getByLabel('Account')).toHaveValue('payable');
  await expect(lineGroup(form, 2).getByLabel('Amount')).toHaveValue('300');
  await expect(enabledRemoveButtons(form)).toHaveCount(0);
});

test('shows the debit total, the credit total and their difference while the User types', async ({ page }) => {
  const form = await openMultiLineForm(page);

  const debitTotal = form.getByTestId('debit-total');
  const creditTotal = form.getByTestId('credit-total');
  const difference = form.getByTestId('difference');

  await expect(debitTotal).toHaveText(amountShown('0'));
  await expect(creditTotal).toHaveText(amountShown('0'));
  await expect(difference).toHaveText(amountShown('0'));

  await fillLine(form, 1, { account: 'expense', side: 'debit', amount: '12500' });
  await expect(debitTotal).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(creditTotal).toHaveText(amountShown('0'));
  await expect(difference).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);

  await fillLine(form, 2, { account: 'cash', side: 'credit', amount: '12000' });
  await expect(debitTotal).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(creditTotal).toHaveText(amountShown('12,000'));
  await expect(difference).toHaveText(amountShown('500'));

  await form.getByRole('button', { name: 'Add line' }).click();
  await expect(lineGroup(form, 3)).toBeVisible();
  await expect(difference).toHaveText(amountShown('500'));

  await fillLine(form, 3, { account: 'payable', side: 'credit', amount: '500' });
  await expect(creditTotal).toHaveText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expect(difference).toHaveText(amountShown('0'));

  await lineGroup(form, 3).getByLabel('Amount').fill('1000');
  await expect(creditTotal).toHaveText(amountShown('13,000'));
  await expect(difference).toHaveText(amountShown('-500'));
});

test('lists an Entry of three lines with every line, and after a reload', async ({ page }) => {
  const memo = `Supplies on account ${randomUUID()}`;
  const form = await openMultiLineForm(page);

  await submitMultiLineEntry(form, {
    day: DAY,
    memo,
    lines: [
      { account: 'expense', side: 'debit', amount: '12500' },
      { account: 'cash', side: 'credit', amount: '5000' },
      { account: 'payable', side: 'credit', amount: '7500' },
    ],
  });

  const entry = listedEntry(page, memo);
  const expectListedWithEveryLine = async (): Promise<void> => {
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(DAY);

    const lines = entry.getByTestId('entry-line');
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toContainText(/expense/i);
    await expect(lines.nth(0)).toContainText(/debit/i);
    await expect(lines.nth(0)).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
    await expect(lines.nth(1)).toContainText(/cash/i);
    await expect(lines.nth(1)).toContainText(/credit/i);
    await expect(lines.nth(1)).toContainText(amountShown('5,000'));
    await expect(lines.nth(2)).toContainText(/payable/i);
    await expect(lines.nth(2)).toContainText(/credit/i);
    await expect(lines.nth(2)).toContainText(amountShown('7,500'));

    await expect(entry.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
  };

  await expectListedWithEveryLine();

  await page.reload();
  await expectListedWithEveryLine();
});

test('refuses an Entry whose debits and credits differ', async ({ page }) => {
  const memo = `Unbalanced ${randomUUID()}`;
  const form = await openMultiLineForm(page);

  await submitMultiLineEntry(form, {
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
  await expect(listedEntry(page, memo)).toHaveCount(0);
});
