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
