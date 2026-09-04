import { expect, test } from '@playwright/test';

/**
 * Phase 0 acceptance criterion.
 *
 * Given the app is deployed
 * When a visitor opens the home page
 * Then the pipeline health of every checked component is rendered
 *
 * The database is deliberately not assumed reachable: this asserts that the
 * pipeline reports a status, not that the status is healthy. A preview
 * deployment without a database must still render, or the E2E gate would be
 * testing the environment rather than the code.
 */
test('renders pipeline health for every checked component', async ({ page }) => {
  await page.goto('/');

  const health = page.getByTestId('health');
  await expect(health).toBeVisible();
  await expect(page.getByTestId('component-postgres')).toContainText(
    /reachable|unreachable/,
  );
});

test('serves the health procedure over the tRPC endpoint', async ({ request }) => {
  const response = await request.get('/api/trpc/health.get');

  expect(response.status()).toBe(200);

  const body: unknown = await response.json();
  expect(body).toMatchObject({
    result: {
      data: {
        status: expect.stringMatching(/^(healthy|degraded)$/),
        components: expect.arrayContaining([
          expect.objectContaining({ name: 'postgres' }),
        ]),
      },
    },
  });
});
