import { defineConfig, devices } from '@playwright/test';
import { APP_PORT, STUB_INFERENCE_PORT } from './tests/system/ports.ts';

const baseURL = `http://localhost:${APP_PORT}`;
const stubInferenceUrl = `http://127.0.0.1:${STUB_INFERENCE_PORT}`;

export default defineConfig({
  testDir: './tests/system',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `bun run db:setup && bun --bun next dev --port ${APP_PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      // Next does not overwrite a variable that is already in the environment,
      // so this wins over whatever .env holds.
      env: { VLM_CHAT_INFERENCE_URL: stubInferenceUrl },
    },
  ],
});
