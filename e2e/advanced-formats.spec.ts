import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import UTIF from 'utif';

async function makePng(page: Page, width: number, height: number) {
  const bytes = await page.evaluate(
    async ({ width: imageWidth, height: imageHeight }) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.fillStyle = '#1746ed';
      context.fillRect(0, 0, imageWidth, imageHeight);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (output) => (output ? resolve(output) : reject(new Error('PNG encode failed.'))),
          'image/png'
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { width, height }
  );
  return Buffer.from(bytes);
}

function makeBmp(width = 2, height = 2) {
  const rowBytes = Math.ceil((width * 3) / 4) * 4;
  const output = Buffer.alloc(54 + rowBytes * height);
  output.write('BM', 0, 'ascii');
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(rowBytes * height, 34);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = 54 + y * rowBytes + x * 3;
      output[offset] = x ? 0x30 : 0xed;
      output[offset + 1] = y ? 0x9a : 0x46;
      output[offset + 2] = 0x17;
    }
  }
  return output;
}

function makeIco(png: Buffer, width: number, height: number) {
  const output = Buffer.alloc(22 + png.length);
  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(1, 4);
  output[6] = width === 256 ? 0 : width;
  output[7] = height === 256 ? 0 : height;
  output.writeUInt16LE(1, 10);
  output.writeUInt16LE(32, 12);
  output.writeUInt32LE(png.length, 14);
  output.writeUInt32LE(22, 18);
  png.copy(output, 22);
  return output;
}

function makeTiff() {
  const rgba = Uint8Array.from([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255, 255, 0, 255, 255, 0, 255, 255,
    255
  ]);
  return Buffer.from(UTIF.encodeImage(rgba.buffer, 3, 2));
}

test('Phase 4 decodes every advanced format locally and isolates unsafe SVG', async ({
  page,
  isMobile
}) => {
  test.setTimeout(180_000);
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/convert');
  const png = await makePng(page, 16, 16);
  const [heif, avif] = await Promise.all([
    readFile(new URL('./fixtures/hevc32.heif', import.meta.url)),
    readFile(new URL('./fixtures/fox.avif', import.meta.url))
  ]);

  await page.locator('[data-image-input]').setInputFiles([
    { name: 'iphone-photo.heif', mimeType: 'image/heif', buffer: heif },
    { name: 'hero.avif', mimeType: 'image/avif', buffer: avif },
    { name: 'brochure.tiff', mimeType: 'image/tiff', buffer: makeTiff() },
    { name: 'legacy.bmp', mimeType: 'image/bmp', buffer: makeBmp() },
    {
      name: 'spinner.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')
    },
    {
      name: 'safe-logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="12"><rect width="20" height="12" fill="#1746ed"/></svg>'
      )
    },
    { name: 'app.ico', mimeType: 'image/x-icon', buffer: makeIco(png, 16, 16) },
    {
      name: 'unsafe-logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/tracker.png"/></svg>'
      )
    }
  ]);

  const queue = page.getByRole('list', { name: 'Conversion queue' });
  await expect(queue.getByText('Ready', { exact: true })).toHaveCount(7, { timeout: 30_000 });
  await expect(queue.getByText('Failed', { exact: true })).toHaveCount(1);
  await expect(queue.getByText('HEIF WASM · on demand')).toBeVisible();
  await expect(queue.getByText('TIFF decoder · on demand')).toBeVisible();
  await expect(queue.getByText(/GIF import is static/)).toBeVisible();
  await expect(queue.getByText(/TIFF import exports page 1 only/)).toBeVisible();
  await expect(queue.getByText(/contains active or external content/)).toBeVisible();

  await page.getByText('Input capabilities', { exact: true }).click();
  await expect(page.getByText('Advanced input support')).toBeVisible();
  await expect(page.getByText('Outputs remain JPEG, PNG or WebP.')).toBeVisible();
  await page.getByLabel('Global output format').selectOption('png');
  await page.getByRole('button', { name: isMobile ? 'Process remaining' : 'Process all' }).click();

  await expect(queue.getByText('Completed', { exact: true })).toHaveCount(7, { timeout: 120_000 });
  await expect(queue.getByText('Failed', { exact: true })).toHaveCount(1);
  const downloads = queue.getByRole('link', { name: /^Download / });
  await expect(downloads).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    const href = await downloads.nth(index).getAttribute('href');
    if (!href) throw new Error('Advanced-format output is missing its Blob URL.');
    const signature = await page.evaluate(async (url) => {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      return [...bytes.slice(0, 8)];
    }, href);
    expect(signature).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(
    requests
      .filter((request) => request.url.startsWith('http'))
      .every((request) => new URL(request.url).hostname === '127.0.0.1')
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});
