import { expect, test } from '@playwright/test';

test('renders pipeline health for every checked component', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');

  const health = page.getByTestId('health');
  await expect(health).toBeVisible();
  await expect(page.getByTestId('component-postgres')).toContainText(
    /reachable|unreachable/,
  );
});

test('re-checks health through the server action', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');

  const checkedAt = page.getByTestId('checked-at');
  const before = await checkedAt.textContent();

  await page.getByRole('button', { name: 'Re-check' }).click();

  await expect(checkedAt).not.toHaveText(before ?? '');
});

test('serves the health procedure over the tRPC endpoint', { tag: '@smoke' }, async ({ request }) => {
  const response = await request.get('/api/trpc/health.get');

  expect(response.status()).toBe(200);

  const body: unknown = await response.json();
  expect(body).toMatchObject({
    result: {
      data: {
        status: 'healthy',
        components: expect.arrayContaining([
          expect.objectContaining({ name: 'postgres', reachable: true }),
        ]),
        checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
      },
    },
  });
});
