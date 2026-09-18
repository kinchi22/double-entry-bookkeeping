import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { SESSION_COOKIE, freshIdentifier, signIn, submitTestSignIn } from './session';

/**
 * Authentication: `milestone/authentication`. The decision is ADR-0021.
 *
 * `/`, `/sign-in`, the OAuth callback and `health.get` answer anybody. Every
 * other page and procedure needs a Session. The page that sends a signed-out
 * visitor away is a courtesy; the procedures refusing them is the rule.
 *
 * The reads a signed-out visitor makes are `@smoke`: against Production they
 * are what shows the app is closed. A spec that signs in needs the test
 * sign-in, which Production does not have, and the procedure spec posts, so
 * neither is (ADR-0014).
 */

const SIGN_IN = /\/sign-in(\?.*)?$/;
const ENTRIES = /\/entries$/;

/**
 * 1. The sign-in page answers
 *
 * Given the app is deployed
 * When a visitor opens the sign-in page
 * Then they are offered Google
 */
test('offers Google on the sign-in page', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/sign-in');

  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
});

/**
 * 2. A signed-out visitor is sent to sign in
 *
 * Given a visitor with no Session
 * When they open the entries page
 * Then they are on the sign-in page instead
 */
test('sends a signed-out visitor from the entries page to sign in', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/entries');

  await expect(page).toHaveURL(SIGN_IN);
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
});

/**
 * 3. The procedures refuse a signed-out caller
 *
 * Given a caller with no Session
 * When they list entries, or post a balanced one, over the tRPC endpoint
 * Then both answer 401
 *
 * The posted entry is valid on purpose, so the refusal cannot be an input
 * error. This is the check the redirect above is only a courtesy for.
 */
test('refuses the entries procedures without a Session', async ({ request }) => {
  const list = await request.get('/api/trpc/entries.list');
  expect(list.status()).toBe(401);

  const post = await request.post('/api/trpc/entries.post', {
    data: {
      entryDate: '2026-09-15',
      memo: `Signed out ${randomUUID()}`,
      lines: [
        { account: 'expense', side: 'debit', amount: 100 },
        { account: 'cash', side: 'credit', amount: 100 },
      ],
    },
  });
  expect(post.status()).toBe(401);
});

/**
 * 4. Signing in returns the visitor where they were going
 *
 * Given a signed-out visitor sent from the entries page to sign in
 * When they sign in
 * Then they are back on the entries page, and can use it
 */
test('returns a visitor to the page they asked for once they sign in', async ({ page }) => {
  await page.goto('/entries');
  await expect(page).toHaveURL(SIGN_IN);

  await submitTestSignIn(page, freshIdentifier());

  await expect(page).toHaveURL(ENTRIES);
  await expect(page.getByRole('form', { name: 'New entry' })).toBeVisible();
});

/**
 * 5. Signing out ends the Session
 *
 * Given a signed-in User
 * When they sign out
 * Then opening the entries page sends them to sign in again
 */
test('ends the Session when the User signs out', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).not.toHaveURL(ENTRIES);

  await page.goto('/entries');
  await expect(page).toHaveURL(SIGN_IN);
});

/**
 * 6. A Session the app did not issue is no Session
 *
 * Given a visitor whose session cookie holds a token nobody was given
 * When they open the entries page
 * Then they are sent to sign in
 */
test('treats an unknown session token as signed out', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: SESSION_COOKIE, value: randomUUID(), url: baseURL ?? '' },
  ]);

  await page.goto('/entries');

  await expect(page).toHaveURL(SIGN_IN);
});

/**
 * 7. A callback the app did not start signs nobody in
 *
 * Given a visitor who never started signing in with Google
 * When they arrive at the Google callback with a state and a code
 * Then they are told sign-in failed, and have no Session
 *
 * The state is what ties a callback to the browser that began the round trip.
 * One the app did not issue is a forged or replayed sign-in.
 *
 * The alert is looked for in the page's main content: Next renders a route
 * announcer with `role="alert"` on every page, so the page as a whole always
 * has one.
 */
test('refuses a Google callback whose state it did not issue', async ({ page }) => {
  await page.goto(`/auth/callback/google?state=${randomUUID()}&code=${randomUUID()}`);

  await expect(page).toHaveURL(SIGN_IN);
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();

  await page.goto('/entries');
  await expect(page).toHaveURL(SIGN_IN);
});

/**
 * 8. The home page sends a signed-in User to their books
 *
 * Given a signed-in User
 * When they open the home page
 * Then they are on the entries page
 *
 * A signed-out visitor stays on the home page; the health specs open it signed
 * out and assert what it renders.
 */
test('sends a signed-in User from the home page to the entries page', async ({ page }) => {
  await signIn(page);

  await page.goto('/');

  await expect(page).toHaveURL(ENTRIES);
});
