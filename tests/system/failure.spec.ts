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

test('quotes the inference server when it rejects the request', async ({
  page,
}) => {
  await page.goto('/');
  await send(page, 'stub/refuse', 'this will not work');

  await expect(page.getByTestId('error-banner')).toContainText(
    'the stub refuses this model',
  );
});
