import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('production first-run welcome opens the usable dashboard and remains dismissed', async ({
  page
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  const dialog = page.getByRole('dialog', { name: 'Welcome to Pixavelo' });
  const workspace = page.locator('.app-shell__workspace');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close welcome guide' })).toBeFocused();
  await expect(workspace).toHaveAttribute('inert', '');
  await expect(workspace).toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('button', { name: 'Continue to dashboard' }).click();
  await expect(dialog).toBeHidden();
  await expect(workspace).not.toHaveAttribute('inert', '');
  await expect(workspace).not.toHaveAttribute('aria-hidden', 'true');
  const chooseImages = page.getByRole('button', { name: 'Choose Images', exact: true });
  await expect(chooseImages).toBeEnabled();
  await chooseImages.focus();
  await expect(chooseImages).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('pixavelo:welcome:v1'))).toBe(
    '{"dismissed":true}'
  );

  await page.reload();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'Powerful image tools. Completely private.' })
  ).toBeVisible();
});
