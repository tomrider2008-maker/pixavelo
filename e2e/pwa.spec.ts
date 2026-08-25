import { expect, test } from '@playwright/test';

test('production build installs its application shell for offline navigation', async ({
  browserName,
  context,
  page,
  request
}) => {
  test.setTimeout(90_000);
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    display?: string;
    icons?: { purpose?: string; sizes?: string }[];
    name?: string;
    scope?: string;
    start_url?: string;
  };
  expect(manifest).toMatchObject({
    name: 'Pixavelo — Private Image Processing Studio',
    display: 'standalone',
    scope: '/',
    start_url: '/'
  });
  expect(manifest.icons?.some((icon) => icon.sizes === 'any')).toBe(true);
  expect(manifest.icons?.some((icon) => icon.purpose === 'maskable')).toBe(true);

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Powerful image tools. Completely private.' })
  ).toBeVisible();
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable.');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  if (browserName === 'webkit') {
    const cacheCount = await page.evaluate(async () => (await caches.keys()).length);
    expect(cacheCount).toBeGreaterThan(0);
    return;
  }

  await context.setOffline(true);
  try {
    await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Metadata & Privacy' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
