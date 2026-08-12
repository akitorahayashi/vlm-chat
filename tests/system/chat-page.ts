import { expect, type Page } from '@playwright/test';

export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  return errors;
}

export async function send(page: Page, modelId: string, text: string) {
  await page.getByLabel('Model').selectOption(modelId);
  await page.getByLabel('Message').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
}

export function lastTurn(page: Page, role: 'user' | 'assistant') {
  return page.locator(`article[data-role="${role}"]`).last();
}

export async function expectNoLayoutOverflow(page: Page) {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  expect(overflows).toBe(false);
}
