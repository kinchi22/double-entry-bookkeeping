import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { ENTRIES_URL } from './routes';

export const SESSION_COOKIE = 'session';

export const freshIdentifier = (): string => `e2e-${randomUUID()}`;

export async function submitTestSignIn(page: Page, identifier: string): Promise<void> {
  const form = page.getByRole('form', { name: 'Test sign-in' });
  await form.getByLabel('Identifier').fill(identifier);
  await form.getByRole('button', { name: 'Sign in' }).click();
}

export async function signIn(page: Page, identifier = freshIdentifier()): Promise<void> {
  await page.goto('/sign-in');
  await submitTestSignIn(page, identifier);
  await expect(page).toHaveURL(ENTRIES_URL);
}

export async function signInForSmoke(
  page: Page,
  context: BrowserContext,
  baseURL: string | undefined,
): Promise<void> {
  const token = process.env['SMOKE_SESSION_TOKEN'] ?? '';
  if (token === '') {
    await signIn(page);
    return;
  }
  expect(baseURL, 'the smoke run needs a baseURL to scope the cookie to').toBeDefined();
  await context.addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL ?? '' }]);
}
