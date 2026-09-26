import { expect, test, type Locator, type Page } from '@playwright/test';
import { entryForm } from './entries';
import { signIn } from './session';
import { entryFormModes } from './settings';

const SIGN_IN = /\/sign-in(\?.*)?$/;

const sidebar = (page: Page): Locator => page.getByRole('navigation', { name: 'Sidebar' });

const SIGNED_IN_PAGES = ['/entries', '/entries/search', '/settings'] as const;

test('shows the Sidebar on every signed-in page, with links to Entries, Entry search and Settings', async ({ page }) => {
  await signIn(page);

  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    const nav = sidebar(page);
    await expect(nav.getByRole('link', { name: 'Entries', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Entry search', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Sign out' })).toBeVisible();
  }
});

test('moves between the signed-in pages through the Sidebar', async ({ page }) => {
  await signIn(page);

  await sidebar(page).getByRole('link', { name: 'Entry search', exact: true }).click();
  await expect(page).toHaveURL(/\/entries\/search(\?.*)?$/);
  await expect(page.getByRole('form', { name: 'Search entries' })).toBeVisible();

  await sidebar(page).getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(entryFormModes(page)).toBeVisible();

  await sidebar(page).getByRole('link', { name: 'Entries', exact: true }).click();
  await expect(page).toHaveURL(/\/entries$/);
  await expect(entryForm(page)).toBeVisible();
});

test('ends the Session when the User signs out from the Sidebar', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');

  await sidebar(page).getByRole('button', { name: 'Sign out' }).click();
  await expect(page).not.toHaveURL(/\/settings$/);

  await page.goto('/settings');
  await expect(page).toHaveURL(SIGN_IN);
});

test('shows no Sidebar to a visitor who is not signed in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('health')).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);

  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);
});
