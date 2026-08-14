import { expect, test } from '@playwright/test';
import {
  collectConsoleErrors,
  expectNoLayoutOverflow,
  lastTurn,
  send,
} from './chat-page';

test('streams a reply, keeps the URL and survives a reload', async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto('/');
  await expect(page).toHaveTitle('VLM Chat');

  const picker = page.getByLabel('Model');

  // The options are whatever the inference server reports; the app ships no
  // list of its own.
  await expect(picker.locator('option')).toHaveText([
    'stub/echo',
    'stub/reasoning',
    'stub/error',
    'stub/slow',
    'stub/refuse',
  ]);

  await send(page, 'stub/echo', 'say hello');

  await expect(lastTurn(page, 'assistant')).toContainText(
    'Hello from the stub.',
  );
  await expect(page).toHaveURL(/\/conversations\/.+/);

  await page.reload();

  await expect(lastTurn(page, 'user')).toContainText('say hello');
  await expect(lastTurn(page, 'assistant')).toContainText(
    'Hello from the stub.',
  );

  await expectNoLayoutOverflow(page);
  expect(consoleErrors).toEqual([]);
});

test('lists the conversation and deletes it', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  const title = `remember me ${crypto.randomUUID()}`;

  await page.goto('/');
  await send(page, 'stub/echo', title);

  const entry = page.getByRole('link', { name: title, exact: true });

  await expect(entry).toBeVisible();

  await page.getByRole('button', { name: `Delete ${title}` }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(entry).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test('persists and resets generation settings without layout overflow', async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto('/');
  await page.getByText('Generation settings', { exact: true }).click();

  await page.getByRole('slider', { name: 'Temperature' }).fill('1.25');
  await page.getByRole('slider', { name: 'Max output tokens' }).fill('512');
  await page.getByRole('slider', { name: 'Top P' }).fill('0.8');
  await page.getByRole('slider', { name: 'Repetition penalty' }).fill('1.15');

  await expectNoLayoutOverflow(page);
  await send(page, 'stub/echo', 'use these settings');
  await expect(lastTurn(page, 'assistant')).toContainText(
    'Hello from the stub.',
  );
  await expect(page).toHaveURL(/\/conversations\/.+/);

  await page.reload();
  await page.getByText('Generation settings', { exact: true }).click();

  await expect(page.getByRole('slider', { name: 'Temperature' })).toHaveValue(
    '1.25',
  );
  await expect(
    page.getByRole('slider', { name: 'Max output tokens' }),
  ).toHaveValue('512');
  await expect(page.getByRole('slider', { name: 'Top P' })).toHaveValue('0.8');
  await expect(
    page.getByRole('slider', { name: 'Repetition penalty' }),
  ).toHaveValue('1.15');

  await page.getByRole('button', { name: 'Reset to defaults' }).click();

  await expect(page.getByRole('slider', { name: 'Temperature' })).toHaveValue(
    '0.7',
  );
  await expect(
    page.getByRole('slider', { name: 'Max output tokens' }),
  ).toHaveValue('2048');
  await expect(page.getByRole('slider', { name: 'Top P' })).toHaveValue('1');
  await expect(
    page.getByRole('slider', { name: 'Repetition penalty' }),
  ).toHaveValue('1');
  await expectNoLayoutOverflow(page);
  expect(consoleErrors).toEqual([]);
});
