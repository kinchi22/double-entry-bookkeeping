import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const externalUrl = process.env['E2E_BASE_URL'];
const baseURL = externalUrl ?? 'http://127.0.0.1:3000';
const isCI = process.env['CI'] === 'true' || process.env['CI'] === '1';

const bypassSecret = process.env['VERCEL_AUTOMATION_BYPASS_SECRET'] ?? '';
const protectionBypass: Pick<NonNullable<PlaywrightTestConfig['use']>, 'extraHTTPHeaders'> =
  bypassSecret === ''
    ? {}
    : { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypassSecret } };

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
