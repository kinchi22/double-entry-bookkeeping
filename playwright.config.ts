import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * With E2E_BASE_URL unset, this drives a production build served by
 * `pnpm --filter @repo/web start`: locally, and in the `E2E build` workflow.
 * With it set, no server is started. The `E2E` job sets it to the Vercel
 * production deployment, and `pnpm verify:gates:e2e` to an empty page every spec
 * must fail against. ADR-0006.
 */
const externalUrl = process.env['E2E_BASE_URL'];
const baseURL = externalUrl ?? 'http://127.0.0.1:3000';
const isCI = process.env['CI'] === 'true' || process.env['CI'] === '1';

/**
 * Vercel's Deployment Protection covers a deployment's own URL, so the `E2E`
 * job supplies the project's bypass secret and every request carries it. An
 * unset secret arrives from Actions as an empty string, and sends no header.
 * The secret can appear in a failure's error text, so that job uploads no
 * report.
 */
const bypassSecret = process.env['VERCEL_AUTOMATION_BYPASS_SECRET'] ?? '';
const protectionBypass: Pick<NonNullable<PlaywrightTestConfig['use']>, 'extraHTTPHeaders'> =
  bypassSecret === ''
    ? {}
    : { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypassSecret } };

// Built separately rather than inline, because exactOptionalPropertyTypes does
// not allow assigning `undefined` to an optional property.
const localServer: Pick<PlaywrightTestConfig, 'webServer'> =
  externalUrl === undefined
    ? {
        webServer: {
          command: 'pnpm --filter @repo/web start',
          url: baseURL,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      }
    : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...protectionBypass,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...localServer,
});
