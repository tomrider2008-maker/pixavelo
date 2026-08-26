import { expect, test, type Page } from '@playwright/test';

async function makePng(page: Page, width = 320, height = 220) {
  const bytes = await page.evaluate(
    async ({ imageWidth, imageHeight }) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      const fill = context.createLinearGradient(0, 0, imageWidth, imageHeight);
      fill.addColorStop(0, '#123b8a');
      fill.addColorStop(1, '#d4a15f');
      context.fillStyle = fill;
      context.fillRect(0, 0, imageWidth, imageHeight);
      context.fillStyle = '#ffffff';
      context.font = '700 32px system-ui';
      context.fillText('PIXAVELO', 28, imageHeight - 34);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('PNG encode failed.'))),
          'image/png'
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { imageWidth: width, imageHeight: height }
  );
  return Buffer.from(bytes);
}

test('premium Convert queue supports search, bulk format, and verified processing', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop workflow probe runs once.');
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/convert');
  const source = await makePng(page);
  await page.locator('[data-image-input]').setInputFiles([
    { name: 'city-campaign.png', mimeType: 'image/png', buffer: source },
    { name: 'product-hero.png', mimeType: 'image/png', buffer: source }
  ]);

  const queue = page.getByRole('list', { name: 'Conversion queue' });
  await expect(queue.getByText('Ready', { exact: true })).toHaveCount(2);
  const search = page.getByRole('searchbox', { name: 'Search conversion queue' });
  await search.fill('product');
  await expect(queue.getByText('product-hero.png', { exact: true })).toBeVisible();
  await expect(queue.getByText('city-campaign.png', { exact: true })).toHaveCount(0);
  await search.clear();

  await page.getByLabel('Set format for selected files').selectOption('webp');
  await expect(page.getByLabel('Output format for city-campaign.png')).toHaveValue('webp');
  await expect(page.getByLabel('Output format for product-hero.png')).toHaveValue('webp');
  await page.getByRole('button', { name: 'Process all' }).click();
  await expect(queue.getByText('Completed', { exact: true })).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Download ZIP' })).toBeEnabled();

  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});

test('premium Convert exposes a dismissible settings sheet on mobile', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile sheet probe runs once.');
  await page.goto('/convert');
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await settings.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  const close = page.getByRole('button', { name: 'Close output settings' }).first();
  await expect(close).toBeVisible();
  await close.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});

test('premium Optimize profiles produce verified output and a difference view', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop optimize probe runs once.');
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/optimize');
  const source = await makePng(page, 640, 440);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'premium-campaign.png',
    mimeType: 'image/png',
    buffer: source
  });
  await expect(page.getByText('Ready to measure')).toBeVisible();
  await page.getByRole('button', { name: /^Web Optimized/ }).click();
  await expect(page.getByRole('combobox', { name: /Quality profile/ })).toHaveValue(
    'web-optimized'
  );
  await page.getByRole('button', { name: 'Compress image' }).click();
  await expect(page.getByRole('link', { name: 'Download optimized image' })).toBeVisible({
    timeout: 30_000
  });
  await expect(page.getByText('Output decoded and verified')).toBeVisible();

  const difference = page.getByRole('button', { name: 'Difference' });
  await difference.click();
  await expect(difference).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Difference amplified')).toBeVisible();
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});
