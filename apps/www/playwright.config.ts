import { defineConfig, devices } from '@playwright/test';

/**
 * Point the suite at an already-running deployment instead of building one.
 *
 * Used to run the same assertions against a preview URL after a deploy, which is the only
 * way to find the differences between the local worker and the real edge.
 */
const externalBaseUrl = process.env['ETYMA_E2E_BASE_URL'];
const baseURL = externalBaseUrl ?? 'http://localhost:8789';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  ...(process.env['CI'] ? { workers: 1 } : {}),
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // The suite runs against the Cloudflare production build under Wrangler, not against the
  // dev server. Server rendering, hydration and the worker runtime are exactly the things
  // a dev server would paper over.
  ...(externalBaseUrl === undefined
    ? {
        webServer: {
          command: 'pnpm run build:cloudflare && pnpm run preview:cloudflare',
          url: baseURL,
          reuseExistingServer: !process.env['CI'],
          timeout: 240_000,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
});
