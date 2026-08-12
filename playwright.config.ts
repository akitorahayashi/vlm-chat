import { defineConfig, devices } from '@playwright/test';
import { SYSTEM_DATABASE_URL } from './tests/system/fixtures/database-lifecycle.ts';
import { APP_PORT, STUB_INFERENCE_PORT } from './tests/system/ports.ts';

const baseURL = `http://localhost:${APP_PORT}`;
const stubInferenceUrl = `http://127.0.0.1:${STUB_INFERENCE_PORT}`;

// The browser tests write conversations through the real application, so they
// get their own file rather than the development database. `db:reset` runs in
// the same command and reads the same variable, so it is this file that is
// dropped and migrated.
export default defineConfig({
  testDir: './tests/system',
  globalSetup: './tests/system/fixtures/database-lifecycle.ts',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // One worker, everywhere. The four browser projects share a single dev server
  // and a single SQLite file, and `page.goto` resolves on load rather than on
  // hydration: run them at once and a click or a file selection lands before
  // React has attached its handler, on whichever project lost the race.
  workers: 1,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      command: 'bun tests/system/fixtures/inference-server.ts',
      url: `${stubInferenceUrl}/health`,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // db:reset rather than db:setup: the specs name conversations by their
      // title, so rows left by a previous run make a second run fail on
      // titles it did not create.
      //
      // --webpack for the same reason `bun run dev` uses it: Turbopack's dev server
      // cannot resolve the Prisma and libsql externals, so every page answers 500
      // and this server never becomes ready. See the note in README.
      command: `bun run db:reset && bun --bun next dev --webpack --port ${APP_PORT}`,
      url: baseURL,
      // Reusing a process here can send test writes into its development DB.
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      // Next does not overwrite a variable that is already in the environment,
      // so these win over whatever .env holds.
      env: {
        VLM_CHAT_INFERENCE_URL: stubInferenceUrl,
        DATABASE_URL: SYSTEM_DATABASE_URL,
      },
    },
  ],
});
