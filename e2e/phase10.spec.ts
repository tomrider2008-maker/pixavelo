import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test('Phase 10 watermark, SHA-256, Base64 and frame extraction are real local workflows', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop utility workflow.');
  test.setTimeout(120_000);
  const nonReadRequests: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) nonReadRequests.push(request.url());
  });
  await page.goto('/developer-tools');
  await expect(page.getByRole('heading', { name: 'Professional Utilities' })).toBeVisible();
  await page.locator('[data-image-input]').setInputFiles(await sampleJpeg(page));
  await expect(page.getByRole('heading', { name: 'Watermark settings' })).toBeVisible();

  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);

  await page.locator('.developer-tools-heading__actions .button--primary').click();
  await expect(page.getByRole('link', { name: 'Download watermarked image' })).toBeVisible({
    timeout: 45_000
  });
  await expect(page.locator('.utility-validation-panel')).toContainText('Removal verified');

  await page.getByRole('tab', { name: 'Hash' }).click();
  await page.locator('.developer-tools-heading__actions .button--primary').click();
  await expect(page.locator('.hash-result code')).toHaveText(/^[a-f0-9]{64}$/);

  await page.getByRole('tab', { name: 'Base64' }).click();
  await page.locator('.developer-tools-heading__actions .button--primary').click();
  await expect(page.getByRole('textbox', { name: 'Encoded Base64' })).toHaveValue(
    /^data:image\/jpeg;base64,/
  );

  await page.getByRole('tab', { name: 'Frames' }).click();
  await page.locator('[data-image-input]').setInputFiles({
    name: 'single-frame.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')
  });
  await page.locator('.developer-tools-heading__actions .button--primary').click();
  const frameDownload = page.getByRole('link', { name: 'Download frame ZIP' });
  const unsupported = page.getByRole('alert');
  await expect(frameDownload.or(unsupported)).toBeVisible({ timeout: 30_000 });
  if (await frameDownload.isVisible()) {
    const bytes = await frameDownload.evaluate(async (link: HTMLAnchorElement) =>
      (await fetch(link.href)).blob().then((blob) => blob.size)
    );
    expect(bytes).toBeGreaterThan(20);
  } else {
    await expect(unsupported).toContainText('browser');
  }
  expect(nonReadRequests).toEqual([]);
});

test('Phase 10 builds a verified sprite PNG and coordinate map', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop utility workflow.');
  test.setTimeout(90_000);
  await page.goto('/developer-tools');
  await page.getByRole('tab', { name: 'Sprite sheet' }).click();
  const first = await sampleJpeg(page, 'sprite-one.jpg', '#1746ed');
  const second = await sampleJpeg(page, 'sprite-two.jpg', '#17345e');
  await page.getByLabel('Choose sprite images').setInputFiles([first, second]);
  await page.locator('.developer-tools-heading__actions .button--primary').click();
  await expect(page.getByRole('heading', { name: 'Verified output' })).toBeVisible({
    timeout: 45_000
  });
  await expect(page.getByText('2 sprites')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PNG' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download JSON map' })).toBeVisible();
});

test('Phase 10 calculators and versioned local presets remain usable without a file', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop utility workflow.');
  await page.goto('/developer-tools');
  await page.getByRole('tab', { name: 'Calculators' }).click();
  await expect(page.getByText('16:9')).toBeVisible();
  await expect(page.getByText('1280 × 720')).toBeVisible();
  await page.getByRole('tab', { name: 'Presets' }).click();
  await page.locator('.developer-tools-heading__actions .button--primary').click();
  await expect(page.getByText('Preset saved on this device.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export JSON' })).toBeVisible();
});

test('Phase 10 mobile keeps utility modes, preview, settings and export action reachable', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile reachability check.');
  await page.goto('/developer-tools');
  await page.locator('[data-image-input]').setInputFiles(await sampleJpeg(page));
  await expect(page.getByRole('heading', { name: 'Professional Utilities' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Watermark' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Watermark settings' })).toBeVisible();
  await expect(page.locator('.developer-tools-mobile-action')).toBeVisible();
});

async function sampleJpeg(page: Page, name = 'campaign-master.jpg', color = '#1746ed') {
  const buffer = Buffer.from(
    await page.evaluate(async (fill) => {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 160;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.fillStyle = '#d9e7fb';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = fill;
      context.fillRect(20, 20, 200, 120);
      context.fillStyle = '#ffffff';
      context.fillRect(50, 55, 140, 20);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (output) => (output ? resolve(output) : reject(new Error('JPEG encoding failed.'))),
          'image/jpeg',
          0.9
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    }, color)
  );
  return { name, mimeType: 'image/jpeg', buffer };
}
