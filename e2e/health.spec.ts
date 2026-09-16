import { expect, test } from '@playwright/test';

/**
 * Every spec here is tagged `@smoke`: each one is a read, so each one may run
 * against Production, which the `E2E` job filters for with `--grep @smoke`.
 * A spec that writes stays untagged and runs in `E2E build` alone. ADR-0014.
 */

/**
 * Phase 0 acceptance criterion.
 *
 * Given the app is deployed
 * When a visitor opens the home page
 * Then the pipeline health of every checked component is rendered
 *
 * The database is deliberately not assumed reachable: this asserts that the
 * pipeline reports a status, not that the status is healthy. A preview
 * deployment whose database cannot be reached must still render, or the E2E
 * gate would be testing the environment rather than the code. A missing or
 * malformed `DATABASE_URL` is not that case: it is configuration, and the app
 * refuses it. ADR-0005.
 */
test('renders pipeline health for every checked component', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');

  const health = page.getByTestId('health');
  await expect(health).toBeVisible();
  await expect(page.getByTestId('component-postgres')).toContainText(
    /reachable|unreachable/,
  );
});

/**
 * Given the health panel is rendered
 * When the visitor asks for a re-check
 * Then the probes run again and the page reports a newer instant
 *
 * This is the write path the app uses -- a Server Action, not the tRPC HTTP
 * endpoint -- so it is asserted rather than assumed. Comparing the timestamp
 * proves the action actually invalidated the render instead of the button
 * merely being clickable.
 */
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
        status: expect.stringMatching(/^(healthy|degraded)$/),
        components: expect.arrayContaining([
          expect.objectContaining({ name: 'postgres' }),
        ]),
        // The contract carries an ISO string, not a Date. Asserted here because
        // this is the boundary where a Date would have silently become one.
        checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
      },
    },
  });
});
