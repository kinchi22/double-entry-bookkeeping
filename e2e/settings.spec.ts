import { expect, test } from '@playwright/test';
import { entryForm, lineGroup } from './entries';
import { SETTINGS_URL, SIGN_IN_URL } from './routes';
import { freshIdentifier, signIn, submitTestSignIn } from './session';
import { entryFormModeChoice, entryFormModes, savedStatus } from './settings';

test('sends a signed-out visitor from the settings page to sign in, and back once they do', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(SIGN_IN_URL);

  await submitTestSignIn(page, freshIdentifier());

  await expect(page).toHaveURL(SETTINGS_URL);
  await expect(entryFormModes(page)).toBeVisible();
});

test('gives a new User Two-line mode, and the Two-line form on the entries page', async ({ page }) => {
  await signIn(page);

  await page.goto('/settings');
  await expect(entryFormModeChoice(page, 'Two-line mode')).toBeChecked();
  await expect(entryFormModeChoice(page, 'Multi-line mode')).not.toBeChecked();

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
  await expect(entryFormModeChoice(page, 'Two-line mode')).toBeChecked();

  await entryFormModeChoice(page, 'Multi-line mode').check();
  await expect(savedStatus(page)).toBeVisible();

  await page.reload();
  await expect(entryFormModeChoice(page, 'Multi-line mode')).toBeChecked();
  await expect(entryFormModeChoice(page, 'Two-line mode')).not.toBeChecked();

  await page.goto('/entries');
  const form = entryForm(page);
  await expect(lineGroup(form, 1)).toBeVisible();
  await expect(lineGroup(form, 2)).toBeVisible();
  await expect(form.getByLabel('Debit account')).toHaveCount(0);
});
