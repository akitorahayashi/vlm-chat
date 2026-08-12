import { expect, test } from '@playwright/test';
import { collectConsoleErrors, lastTurn, send } from './chat-page';

test('shows reasoning in its own disclosure, apart from the answer', async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto('/');
  await send(page, 'stub/reasoning', 'why is the sky blue?');

  const answer = lastTurn(page, 'assistant');

  await expect(answer).toContainText('Blue.');

  const disclosure = answer.locator('details');

  await expect(disclosure).toContainText('The sky scatters short wavelengths.');
  await expect(disclosure).not.toContainText('Blue.');

  expect(consoleErrors).toEqual([]);
});
