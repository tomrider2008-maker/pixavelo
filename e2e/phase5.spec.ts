import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function makePng(page: Page, width: number, height: number, noise = false): Promise<Buffer> {
  const bytes = await page.evaluate(
    async ({ width: imageWidth, height: imageHeight, noise: useNoise }) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      if (useNoise) {
        const pixels = context.createImageData(imageWidth, imageHeight);
        let state = 0x51a3c9d7;
        for (let index = 0; index < pixels.data.length; index += 4) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          pixels.data[index] = state & 0xff;
          pixels.data[index + 1] = (state >>> 8) & 0xff;
          pixels.data[index + 2] = (state >>> 16) & 0xff;
          pixels.data[index + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
      } else {
        context.fillStyle = '#1746ed';
        context.fillRect(0, 0, imageWidth, imageHeight);
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (output) => (output ? resolve(output) : reject(new Error('PNG encode failed.'))),
          'image/png'
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { width, height, noise }
  );
  return Buffer.from(bytes);
}

function expectPngDimensions(bytes: Buffer, width: number, height: number) {
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.readUInt32BE(16)).toBe(width);
  expect(bytes.readUInt32BE(20)).toBe(height);
}

test('Phase 5 maximum-visual-quality mode reaches target using bounded resize fallback', async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'chromium', 'One deterministic engine probe is sufficient.');
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/optimize?preset=500kb');
  const source = await makePng(page, 900, 675, true);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'high-detail-source.png',
    mimeType: 'image/png',
    buffer: source
  });
  await page.getByRole('button', { name: '50 KB', exact: true }).click();
  await page.getByRole('radio', { name: 'Maximum visual quality' }).check();
  await page.getByRole('button', { name: 'Compress image' }).click();

  const outputLink = page.getByRole('link', { name: 'Download optimized image' });
  await expect(outputLink).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/target met against actual Blob/)).toBeVisible();
  await expect(page.getByText(/Dimensions were reduced only after minimum quality/)).toBeVisible();
  await expect(page.getByText('Removal verified', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await outputLink.click();
  const downloadPath = await (await downloadPromise).path();
  if (!downloadPath) throw new Error('Target-size download is unavailable.');
  const output = await readFile(downloadPath);
  expect(output.byteLength).toBeLessThanOrEqual(50 * 1024);
  expect(output.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(output.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});

test('Phase 5 social preset produces its exact verified output canvas locally', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== 'chromium', 'One deterministic engine probe is sufficient.');
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/resize');
  const source = await makePng(page, 1200, 1500);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'campaign-source.png',
    mimeType: 'image/png',
    buffer: source
  });
  await page.getByRole('button', { name: /Instagram portrait/ }).click();
  await expect(page.getByText('1080 × 1350', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Apply resize' }).click();

  const outputLink = page.getByRole('link', { name: 'Download resized image' });
  await expect(outputLink).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText('Output decoded and verified')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await outputLink.click();
  const downloadPath = await (await downloadPromise).path();
  if (!downloadPath) throw new Error('Resize download is unavailable.');
  expectPngDimensions(await readFile(downloadPath), 1080, 1350);
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});

test('Phase 5 optimize route accepts an advanced HEIF input through the local decoder', async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'chromium', 'Advanced decoder probe runs once.');
  const heif = await readFile(new URL('./fixtures/hevc32.heif', import.meta.url));

  await page.goto('/optimize');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'phone-photo.heif',
    mimeType: 'image/heif',
    buffer: heif
  });
  await expect(page.getByText(/HEIC · 64 × 64/).first()).toBeVisible();
  await page.getByRole('combobox', { name: /Quality profile/ }).selectOption('email-optimized');
  await page.getByRole('button', { name: 'Compress image' }).click();

  const outputLink = page.getByRole('link', { name: 'Download optimized image' });
  await expect(outputLink).toBeVisible({ timeout: 90_000 });
  const downloadPromise = page.waitForEvent('download');
  await outputLink.click();
  const downloadPath = await (await downloadPromise).path();
  if (!downloadPath) throw new Error('Advanced-format download is unavailable.');
  const output = await readFile(downloadPath);
  expect([...output.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
});
