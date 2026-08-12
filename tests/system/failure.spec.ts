import { expect, test } from '@playwright/test';
import { collectConsoleErrors, lastTurn, send } from './chat-page';

test('keeps the partial answer visible when the stream fails part-way', async ({
  page,
}) => {
  // The upstream failure arrives inside a 200 response, so nothing is logged to
  // the console and the usual no-console-errors invariant still holds.
  const consoleErrors = collectConsoleErrors(page);

  await page.goto('/');
  await send(page, 'stub/error', 'break something');

  await expect(page.getByTestId('error-banner')).toContainText(
    'the stub ran out of memory',
  );
  await expect(lastTurn(page, 'assistant')).toContainText('Partial answer');

  expect(consoleErrors).toEqual([]);
});

test('quotes the inference server when it rejects the request, and keeps the retry in one conversation', async ({
  page,
}) => {
  await page.goto('/');
  await send(page, 'stub/refuse', 'this will not work');

  await expect(page.getByTestId('error-banner')).toContainText(
    'the stub refuses this model',
  );

  // The message was stored before the server was contacted, so the browser has
  // to end up on the conversation holding it.
  await expect(page).toHaveURL(/\/conversations\/.+/);
  await expect(lastTurn(page, 'user')).toContainText('this will not work');

  const conversation = page.url();

  await send(page, 'stub/echo', 'try again');

  await expect(lastTurn(page, 'assistant')).toContainText(
    'Hello from the stub.',
  );
  // Same URL: retrying continued the stored conversation instead of forking a
  // second one and stranding the first message.
  expect(page.url()).toBe(conversation);
});
