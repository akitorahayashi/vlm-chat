import { expect, test } from '@playwright/test';
import { collectConsoleErrors, lastTurn, send } from './chat-page';

test('previews an attached image and serves it back after a reload', async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto('/');
  await page
    .locator('input[type="file"]')
    .setInputFiles('tests/system/fixtures/pixel.png');

  const preview = page.getByTestId('attachment-tray').locator('img');

  // The composer preview has to be a data URL: img-src allows 'self' and data:,
  // so a blob: object URL would silently fail to render.
  await expect(preview).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

  await send(page, 'stub/echo', 'what is this?');
  await expect(lastTurn(page, 'assistant')).toContainText(
    'Hello from the stub.',
  );
  // The URL only changes once the stream has ended and the turn is stored.
  await expect(page).toHaveURL(/\/conversations\/.+/);

  await page.reload();

  const stored = lastTurn(page, 'user').locator('img');

  await expect(stored).toHaveAttribute('src', /^\/api\/attachments\//);
  await expect
    .poll(() =>
      stored.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);

  expect(consoleErrors).toEqual([]);
});
