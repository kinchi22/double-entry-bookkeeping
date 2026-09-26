import { expect, type Locator, type Page } from '@playwright/test';

export type EntryFormMode = 'Two-line mode' | 'Multi-line mode';

export const entryFormModes = (page: Page): Locator =>
  page.getByRole('group', { name: 'Entry form mode' });

export const entryFormModeChoice = (page: Page, mode: EntryFormMode): Locator =>
  entryFormModes(page).getByRole('radio', { name: mode });

export const savedStatus = (page: Page): Locator =>
  page.getByRole('status').filter({ hasText: /saved/i });

export async function setEntryFormMode(page: Page, mode: EntryFormMode): Promise<void> {
  await page.goto('/settings');
  const choice = entryFormModeChoice(page, mode);
  await expect(choice).toBeVisible();
  if (!(await choice.isChecked())) {
    await choice.check();
    await expect(savedStatus(page)).toBeVisible();
  }
  await expect(choice).toBeChecked();
}
