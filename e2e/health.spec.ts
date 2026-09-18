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
 * pipeline reports a status, not that the status is healthy. A degraded
 * deployment must still render, or the E2E gate would be testing the
 * environment rather than the code. A missing or malformed `DATABASE_URL` is
 * not that case: it is configuration, and the app refuses it. ADR-0005.
 *
 * Whether the database actually answered is the endpoint spec's claim, below.
 * The panel is what the page does with either answer; the endpoint is the
 * healthcheck. ADR-0020.
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

/**
 * Given a deployment
 * When the healthcheck is called over HTTP
 * Then it answers healthy, with every component it checked reachable
 *
 * The strict answer, unlike the panel above: this is the deployment's
 * healthcheck, and it outlives the panel that renders it. Against Production
 * it is the one assertion that fails when the database is unreachable, and
 * `healthy` tightens by itself as components are added, because it means all of
 * them answered. ADR-0020.
 *
 * It says nothing about migrations: the probe issues `select 1`. That the
 * schema arrived is the entries page spec's claim (ADR-0014).
 */
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
        // The contract carries an ISO string, not a Date. Asserted here because
        // this is the boundary where a Date would have silently become one.
        checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
      },
    },
  });
});
