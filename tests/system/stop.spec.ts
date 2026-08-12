import { expect, test } from '@playwright/test';
import { collectConsoleErrors, lastTurn, send } from './chat-page';

test('stops a running stream and records the interruption', async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto('/');
  await send(page, 'stub/slow', 'count slowly');

  const answer = lastTurn(page, 'assistant');

  await expect(answer).toContainText('one');

  await page.getByRole('button', { name: 'Stop' }).click();

  await expect(answer).toContainText('Interrupted.');
  await expect(page).toHaveURL(/\/conversations\/.+/);

  // The turn is closed on the server a moment after the browser stops reading,
  // so a single reload can land between the two.
  await expect
    .poll(
      async () => {
        await page.reload();

        return page.locator('article[data-status="aborted"]').count();
      },
      { timeout: 15_000 },
    )
    .toBe(1);

  const stored = page.locator('article[data-status="aborted"]');

  await expect(stored).toContainText('Interrupted.');
  await expect(stored).toContainText('one');

  expect(consoleErrors).toEqual([]);
});
