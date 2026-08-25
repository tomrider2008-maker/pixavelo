import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test('Phase 9 generates verified responsive AVIF, WebP and JPEG assets with markup', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop codec workflow.');
  test.setTimeout(120_000);
  const nonReadRequests: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) nonReadRequests.push(request.url());
  });
  await page.goto('/web-assets');
  await expect(page.getByRole('heading', { name: 'Web Asset Studio' })).toBeVisible();
  await page.locator('[data-image-input]').setInputFiles(await sampleJpeg(page));
  await expect(page.getByTitle('product-hero.jpg')).toBeVisible();

  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);

  await page.getByRole('button', { name: 'Remove 768px breakpoint' }).click();
  await page.getByRole('button', { name: 'Remove 1200px breakpoint' }).click();
  await page.getByRole('button', { name: 'Remove 1600px breakpoint' }).click();
  await page.getByRole('spinbutton', { name: 'Breakpoint 1 width' }).fill('96');
  await page.getByRole('button', { name: 'Generate assets' }).first().click();

  await expect(page.getByText('Output package verified')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.web-verified-output')).toContainText('3');
  await expect(page.locator('.web-markup-panel')).toContainText('image/avif');
  await expect(page.locator('.web-markup-panel')).toContainText('product-hero-96.jpg');
  const zipLink = page.getByRole('link', { name: 'Download ZIP' });
  await expect(zipLink).toBeVisible();
  const zipSize = await zipLink.evaluate(async (link: HTMLAnchorElement) =>
    (await fetch(link.href)).blob().then((blob) => blob.size)
  );
  expect(zipSize).toBeGreaterThan(100);
  expect(nonReadRequests).toEqual([]);
});

test('Phase 9 produces favicon, app-icon and manifest packages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop codec workflow.');
  test.setTimeout(90_000);
  await page.goto('/web-assets');
  await page.locator('[data-image-input]').setInputFiles(await sampleJpeg(page));
  await page.getByRole('tab', { name: 'Icons & favicon' }).click();
  await expect(page.getByRole('heading', { name: 'Favicon & app icon package' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate assets' }).first().click();
  await expect(page.getByText('Output package verified')).toBeVisible({ timeout: 75_000 });
  await expect(page.locator('.web-verified-output')).toContainText('8');
  await expect(page.locator('.web-markup-panel')).toContainText('site.webmanifest');
  await expect(page.getByRole('link', { name: 'Download ZIP' })).toBeVisible();
});

test('Phase 9 mobile keeps source, modes, breakpoints and primary action reachable', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile reachability check.');
  await page.goto('/web-assets');
  await page.locator('[data-image-input]').setInputFiles(await sampleJpeg(page));
  await expect(page.getByRole('heading', { name: 'Web Asset Studio' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Responsive images' })).toBeVisible();
  await expect(page.getByText('Source preview')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Breakpoint 1 width' })).toBeVisible();
  await expect(page.locator('.web-assets-mobile-action')).toBeVisible();
});

async function sampleJpeg(page: Page) {
  const buffer = Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 160;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.fillStyle = '#d9e7fb';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#1746ed';
      context.fillRect(24, 22, 92, 116);
      context.fillStyle = '#17345e';
      context.fillRect(124, 44, 92, 94);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (output) => (output ? resolve(output) : reject(new Error('JPEG encoding failed.'))),
          'image/jpeg',
          0.88
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    })
  );
  return { name: 'product-hero.jpg', mimeType: 'image/jpeg', buffer };
}
