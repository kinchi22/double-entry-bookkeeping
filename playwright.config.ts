import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * With E2E_BASE_URL unset, this drives a production build served by
 * `pnpm --filter @repo/web start`: locally, and in the `E2E build` job, which is
 * the merge gate. With it set, no server is started. The `E2E` job sets it to the
 * Vercel preview deployment, and `pnpm verify:gates:e2e` to an empty page every
 * spec must fail against. ADR-0006.
 */
const previewUrl = process.env['E2E_BASE_URL'];
const baseURL = previewUrl ?? 'http://127.0.0.1:3000';
const isCI = process.env['CI'] === 'true' || process.env['CI'] === '1';

// Built separately rather than inline, because exactOptionalPropertyTypes does
// not allow assigning `undefined` to an optional property.
const localServer: Pick<PlaywrightTestConfig, 'webServer'> =
  previewUrl === undefined
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
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...localServer,
});
