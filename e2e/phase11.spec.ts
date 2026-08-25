import { expect, test, type Page } from '@playwright/test';

test('Phase 11 processes a 120-file batch with bounded DOM, memory and network behavior', async ({
  page
}, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== 'chromium', 'Deterministic Chromium stress probe.');
  const nonReadRequests: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) nonReadRequests.push(request.url());
  });
  await page.goto('/batch');
  const source = await samplePng(page, 8, 8);
  const heapBefore = await page.evaluate(() =>
    Reflect.get(performance, 'memory')
      ? Number(Reflect.get(Reflect.get(performance, 'memory'), 'usedJSHeapSize'))
      : 0
  );
  await page.locator('[data-batch-image-input]').setInputFiles(
    Array.from({ length: 120 }, (_, index) => ({
      name: `stress-${String(index + 1).padStart(3, '0')}.png`,
      mimeType: 'image/png',
      buffer: source
    }))
  );
  await expect(page.getByRole('tab', { name: 'Waiting 120' })).toBeVisible({ timeout: 60_000 });
  expect(await page.locator('[aria-setsize="120"]').count()).toBeLessThan(30);
  await page.getByRole('button', { name: 'Start batch' }).click();
  await expect(page.getByRole('tab', { name: 'Completed 120' })).toBeVisible({ timeout: 120_000 });
  const heapAfter = await page.evaluate(() =>
    Reflect.get(performance, 'memory')
      ? Number(Reflect.get(Reflect.get(performance, 'memory'), 'usedJSHeapSize'))
      : 0
  );
  if (heapBefore > 0 && heapAfter > 0)
    expect(heapAfter - heapBefore).toBeLessThan(256 * 1024 * 1024);
  expect(nonReadRequests).toEqual([]);
});

test('Phase 11 isolates a corrupt image after safe preflight without losing the workspace', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'One corrupt decoder probe is sufficient.');
  await page.goto('/web-assets');
  const corrupt = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(corrupt);
  corrupt.writeUInt32BE(32, 16);
  corrupt.writeUInt32BE(32, 20);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: corrupt
  });
  await page.getByRole('button', { name: 'Generate assets' }).first().click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Web Asset Studio' })).toBeVisible();
});

test('Phase 11 responsive QA keeps critical routes inside the document viewport', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== 'chromium', 'Chromium viewport matrix.');
  const routes = [
    ['/batch', 'Batch Studio'],
    ['/privacy', 'Metadata & Privacy'],
    ['/web-assets', 'Web Asset Studio'],
    ['/developer-tools', 'Professional Utilities']
  ] as const;
  for (const width of [320, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, heading] of routes) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
    }
  }
});

test('Phase 11 browser QA loads hardening surfaces across supported engines', async ({ page }) => {
  await page.goto('/security');
  await expect(page.getByRole('heading', { name: 'Security design' })).toBeVisible();
  await page.goto('/developer-tools');
  await expect(page.getByRole('heading', { name: 'Professional Utilities' })).toBeVisible();
  await page.goto('/web-assets');
  await expect(page.getByRole('heading', { name: 'Web Asset Studio' })).toBeVisible();
});

async function samplePng(page: Page, width: number, height: number) {
  return Buffer.from(
    await page.evaluate(
      async ({ imageWidth, imageHeight }) => {
        const canvas = document.createElement('canvas');
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable.');
        context.fillStyle = '#1746ed';
        context.fillRect(0, 0, imageWidth, imageHeight);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (output) => (output ? resolve(output) : reject(new Error('PNG encoding failed.'))),
            'image/png'
          )
        );
        return [...new Uint8Array(await blob.arrayBuffer())];
      },
      { imageWidth: width, imageHeight: height }
    )
  );
}
