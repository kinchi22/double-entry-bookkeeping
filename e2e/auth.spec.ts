import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { SESSION_COOKIE, freshIdentifier, signIn, submitTestSignIn } from './session';

const SIGN_IN = /\/sign-in(\?.*)?$/;
const ENTRIES = /\/entries$/;

test('offers Google on the sign-in page', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/sign-in');

  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
});

test('starts a Google sign-in only when the visitor follows the link', async ({ page }) => {
  const googleSignIns: string[] = [];
  await page.route(
    (url) => url.pathname === '/sign-in/google',
    async (route) => {
      googleSignIns.push(route.request().url());
      await route.abort();
    },
  );

  await page.goto('/sign-in');
  const google = page.getByRole('link', { name: 'Sign in with Google' });
  await expect(google).toBeVisible();

  await google.hover();
  await google.focus();
  await page.waitForLoadState('networkidle');
  expect(googleSignIns).toEqual([]);

  await google.click();
  await expect.poll(() => googleSignIns.length).toBeGreaterThan(0);
});

test('sends a signed-out visitor from the entries page to sign in', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/entries');

  await expect(page).toHaveURL(SIGN_IN);
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
});

test('refuses the entries procedures without a Session', async ({ request }) => {
  const search = await request.get('/api/trpc/entries.search');
  expect(search.status()).toBe(401);

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

test('returns a visitor to the page they asked for once they sign in', async ({ page }) => {
  await page.goto('/entries');
  await expect(page).toHaveURL(SIGN_IN);

  await submitTestSignIn(page, freshIdentifier());

  await expect(page).toHaveURL(ENTRIES);
  await expect(page.getByRole('form', { name: 'New entry' })).toBeVisible();
});

test('ends the Session when the User signs out', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).not.toHaveURL(ENTRIES);

  await page.goto('/entries');
  await expect(page).toHaveURL(SIGN_IN);
});

test('treats an unknown session token as signed out', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: SESSION_COOKIE, value: randomUUID(), url: baseURL ?? '' },
  ]);

  await page.goto('/entries');

  await expect(page).toHaveURL(SIGN_IN);
});

test('refuses a Google callback whose state it did not issue', async ({ page }) => {
  await page.goto(`/auth/callback/google?state=${randomUUID()}&code=${randomUUID()}`);

  await expect(page).toHaveURL(SIGN_IN);
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();

  await page.goto('/entries');
  await expect(page).toHaveURL(SIGN_IN);
});

test('sends a signed-in User from the home page to the entries page', async ({ page }) => {
  await signIn(page);

  await page.goto('/');

  await expect(page).toHaveURL(ENTRIES);
});
