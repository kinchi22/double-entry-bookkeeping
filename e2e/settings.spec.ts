import { expect, test, type Locator, type Page } from '@playwright/test';
import { entryForm, lineGroup } from './entries';
import { freshIdentifier, signIn, submitTestSignIn } from './session';
import { entryFormModes, savedStatus } from './settings';

const SIGN_IN = /\/sign-in(\?.*)?$/;
const SETTINGS = /\/settings$/;

const twoLineMode = (page: Page): Locator =>
  entryFormModes(page).getByRole('radio', { name: 'Two-line mode' });
const multiLineMode = (page: Page): Locator =>
  entryFormModes(page).getByRole('radio', { name: 'Multi-line mode' });

test('sends a signed-out visitor from the settings page to sign in, and back once they do', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(SIGN_IN);

  await submitTestSignIn(page, freshIdentifier());

  await expect(page).toHaveURL(SETTINGS);
  await expect(entryFormModes(page)).toBeVisible();
});

test('gives a new User Two-line mode, and the Two-line form on the entries page', async ({ page }) => {
  await signIn(page);

  await page.goto('/settings');
  await expect(twoLineMode(page)).toBeChecked();
  await expect(multiLineMode(page)).not.toBeChecked();

  await page.goto('/entries');
  const form = entryForm(page);
  await expect(form.getByLabel('Debit account')).toBeVisible();
  await expect(form.getByLabel('Credit account')).toBeVisible();
  await expect(form.getByLabel('Amount')).toHaveCount(1);
  await expect(lineGroup(form, 1)).toHaveCount(0);
});

test('keeps Multi-line mode once chosen, after a reload, and shows the Multi-line form on the entries page', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');
  await expect(twoLineMode(page)).toBeChecked();

  await multiLineMode(page).check();
  await expect(savedStatus(page)).toBeVisible();

  await page.reload();
  await expect(multiLineMode(page)).toBeChecked();
  await expect(twoLineMode(page)).not.toBeChecked();

  await page.goto('/entries');
  const form = entryForm(page);
  await expect(lineGroup(form, 1)).toBeVisible();
  await expect(lineGroup(form, 2)).toBeVisible();
  await expect(form.getByLabel('Debit account')).toHaveCount(0);
});
