import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * How a spec becomes a signed-in User. ADR-0021.
 *
 * Google cannot be driven from a spec, so a spec signs in through the test
 * sign-in: a form on `/sign-in` that exists only where `AUTH_TEST_LOGIN` is set,
 * which is never Production. Each identifier is one User, so a spec that signs
 * in with a fresh one owns nothing it did not write itself.
 *
 * The form's name, its field, its button, and the cookie name below are the
 * contract for sign-in. Renaming one is a spec change (ADR-0002).
 */

/** The cookie a Session travels in. */
export const SESSION_COOKIE = 'session';

/** An identifier no other run can have used, so a new User every time. */
export const freshIdentifier = (): string => `e2e-${randomUUID()}`;

/**
 * Fills the test sign-in on the page it is already on. The caller decides how
 * it got there, because where the User lands afterwards depends on that.
 */
export async function submitTestSignIn(page: Page, identifier: string): Promise<void> {
  const form = page.getByRole('form', { name: 'Test sign-in' });
  await form.getByLabel('Identifier').fill(identifier);
  await form.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * Signs in as a new User, or as `identifier`, and waits to be let in. Signing in
 * with nowhere else to go lands on the entries page.
 */
export async function signIn(page: Page, identifier = freshIdentifier()): Promise<void> {
  await page.goto('/sign-in');
  await submitTestSignIn(page, identifier);
  await expect(page).toHaveURL(/\/entries$/);
}

/**
 * Signs a `@smoke` spec in wherever it runs.
 *
 * Against Production there is no test sign-in. The smoke run holds the Smoke
 * User's session token as `SMOKE_SESSION_TOKEN` and presents it as the cookie.
 * Everywhere else -- `E2E build`, a local run -- the variable is unset, and the
 * spec signs in as a new User instead.
 */
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
