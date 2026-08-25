import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

type BrowserFormat = 'image/jpeg' | 'image/png' | 'image/webp';

async function makeImage(
  page: Page,
  type: BrowserFormat,
  dimensions: { readonly width: number; readonly height: number } = { width: 12, height: 8 },
  noise = false
) {
  const bytes = await page.evaluate(
    async ({ mime, dimensions: size, noise: useNoise }) => {
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas context unavailable.');
      if (useNoise) {
        const pixels = context.createImageData(size.width, size.height);
        let state = 0x1234abcd;
        for (let index = 0; index < pixels.data.length; index += 4) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          pixels.data[index] = state & 0xff;
          pixels.data[index + 1] = (state >>> 8) & 0xff;
          pixels.data[index + 2] = (state >>> 16) & 0xff;
          pixels.data[index + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
      } else {
        context.fillStyle = 'rgba(23, 70, 237, 0.7)';
        context.fillRect(0, 0, size.width, size.height);
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Encode failed.'))),
          mime,
          0.9
        );
      });
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { mime: type, dimensions, noise }
  );
  return Buffer.from(bytes);
}

function readPngDimensions(bytes: Buffer) {
  expectSignature(bytes, 'image/png');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const extension: Record<BrowserFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const targetValue: Record<BrowserFormat, 'jpeg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function expectSignature(bytes: Buffer, mime: BrowserFormat) {
  if (mime === 'image/jpeg') expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  if (mime === 'image/png') {
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mime === 'image/webp') {
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
  }
}

function readStoredZipEntries(bytes: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= bytes.byteLength && bytes.readUInt32LE(offset) === 0x04034b50) {
    expect(bytes.readUInt16LE(offset + 8)).toBe(0);
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString('utf8');
    entries.set(name, bytes.subarray(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  expect(bytes.readUInt32LE(offset)).toBe(0x02014b50);
  expect(bytes.readUInt32LE(bytes.byteLength - 22)).toBe(0x06054b50);
  return entries;
}

test('dashboard shell and command palette work on desktop', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Powerful image tools. Completely private.' })
  ).toBeVisible();
  await expect(page.getByText('No uploads • No account • Local processing')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search tools and actions' }).fill('privacy');
  await page.getByRole('button', { name: /Privacy/ }).click();
  await expect(page.getByRole('heading', { name: 'Metadata & Privacy' })).toBeVisible();
});

test('core conversion matrix produces real verified files without image network requests', async ({
  page,
  isMobile
}) => {
  test.setTimeout(90_000);
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  const cases: readonly [BrowserFormat, BrowserFormat][] = [
    ['image/jpeg', 'image/png'],
    ['image/png', 'image/jpeg'],
    ['image/jpeg', 'image/webp'],
    ['image/webp', 'image/jpeg']
  ];

  for (const [sourceMime, outputMime] of cases) {
    await page.goto(`/convert?to=${targetValue[outputMime]}`);
    const input = await makeImage(page, sourceMime);
    await page.locator('[data-image-input]').setInputFiles({
      name: `sample.${extension[sourceMime]}`,
      mimeType: sourceMime,
      buffer: input
    });
    const queue = page.getByRole('list', { name: 'Conversion queue' });
    await expect(queue.getByText('Ready', { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: isMobile ? 'Process remaining' : 'Process all' })
      .click();
    await expect(queue.getByText('Completed', { exact: true })).toBeVisible({ timeout: 20_000 });

    const downloadLink = page.getByRole('link', { name: /^Download sample-converted\./ });
    await expect(downloadLink).toHaveAttribute('download', /^sample-converted\./);
    const href = await downloadLink.getAttribute('href');
    if (!href) throw new Error('Completed output is missing its Blob URL.');
    const output = Buffer.from(
      await page.evaluate(async (url) => {
        const response = await fetch(url);
        return [...new Uint8Array(await response.arrayBuffer())];
      }, href)
    );
    expectSignature(output, outputMime);
  }

  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(
    requests
      .filter((request) => request.url.startsWith('http'))
      .every((request) => new URL(request.url).hostname === '127.0.0.1')
  ).toBe(true);
});

test('universal converter isolates failures and creates a verified mixed-output ZIP locally', async ({
  page,
  isMobile
}) => {
  test.setTimeout(120_000);
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/convert');
  const [png, jpeg, webp] = await Promise.all([
    makeImage(page, 'image/png', { width: 48, height: 32 }),
    makeImage(page, 'image/jpeg', { width: 40, height: 30 }),
    makeImage(page, 'image/webp', { width: 36, height: 24 })
  ]);
  await page.locator('[data-image-input]').setInputFiles([
    { name: 'photo.png', mimeType: 'image/png', buffer: png },
    { name: 'cover.jpg', mimeType: 'image/jpeg', buffer: jpeg },
    { name: 'mark.webp', mimeType: 'image/webp', buffer: webp },
    {
      name: 'broken.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    }
  ]);

  const queue = page.getByRole('list', { name: 'Conversion queue' });
  await expect(queue.getByText('Ready', { exact: true })).toHaveCount(3);
  await expect(queue.getByText('Failed', { exact: true })).toHaveCount(1);
  await expect(page.locator('[data-folder-input]')).toHaveAttribute('webkitdirectory', '');

  await page.getByLabel('Preset').selectOption('web-delivery');
  await page.getByLabel('Naming pattern').fill('{name}-{index}');
  await page.getByLabel('Output format for photo.png').selectOption('jpeg');
  await page.getByLabel('Output format for mark.webp').selectOption('png');
  await page.getByRole('button', { name: isMobile ? 'Process remaining' : 'Process all' }).click();

  await expect(queue.getByText('Completed', { exact: true })).toHaveCount(3, { timeout: 45_000 });
  await expect(queue.getByText('Failed', { exact: true })).toHaveCount(1);
  const issuesTab = page.getByRole('tab', { name: 'Issues 1' });
  if (isMobile) {
    await page.evaluate(() => window.scrollTo({ top: 0 }));
  }
  await issuesTab.click();
  await expect(queue.getByText('broken.jpg', { exact: true })).toBeVisible();
  await expect(queue.getByText('photo.png', { exact: true })).toHaveCount(0);
  const allTab = page.getByRole('tab', { name: 'All 4' });
  await allTab.click();

  const zipButton = page.getByRole('button', { name: 'Download ZIP' });
  await expect(zipButton).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await zipButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pixavelo-converted-\d{4}-\d{2}-\d{2}\.zip$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const entries = readStoredZipEntries(await readFile(path));
  expect([...entries.keys()]).toEqual(['photo-01.jpg', 'cover-02.webp', 'mark-03.png']);
  expectSignature(entries.get('photo-01.jpg') ?? Buffer.alloc(0), 'image/jpeg');
  expectSignature(entries.get('cover-02.webp') ?? Buffer.alloc(0), 'image/webp');
  expectSignature(entries.get('mark-03.png') ?? Buffer.alloc(0), 'image/png');

  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});

test('mobile layout uses touch navigation without horizontal overflow', async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, 'Mobile project only.');
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: 'Choose', exact: true })).toBeVisible();
});

test('target-size compression creates a real bounded WebP output without uploads', async ({
  page
}) => {
  test.setTimeout(90_000);
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/optimize?preset=500kb');
  const input = await makeImage(page, 'image/png', { width: 512, height: 384 }, true);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'compression-source.png',
    mimeType: 'image/png',
    buffer: input
  });
  await expect(page.getByText('Ready to measure')).toBeVisible();
  const target = page.getByRole('spinbutton', { name: /Maximum file size/ });
  await target.fill('100');
  const compress = page.getByRole('button', { name: 'Compress image' });
  await expect(compress).toBeEnabled();
  await compress.click();

  const downloadLink = page.getByRole('link', { name: 'Download optimized image' });
  await expect(downloadLink).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Output decoded and verified')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const output = await readFile(path);
  expectSignature(output, 'image/webp');
  expect(output.byteLength).toBeLessThanOrEqual(100 * 1024);
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});

test('resize and rotation produce verified requested PNG dimensions', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/resize');
  const input = await makeImage(page, 'image/png', { width: 120, height: 80 });
  await page.locator('[data-image-input]').setInputFiles({
    name: 'transform-source.png',
    mimeType: 'image/png',
    buffer: input
  });

  const width = page.getByRole('spinbutton', { name: 'Width' });
  await expect(width).toHaveValue('120');
  await width.fill('30');
  await expect(page.getByRole('spinbutton', { name: 'Height' })).toHaveValue('20');
  await page.getByRole('button', { name: '90°' }).click();
  await expect(page.getByText('20 × 30', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Apply resize' }).click();

  const downloadLink = page.getByRole('link', { name: 'Download resized image' });
  await expect(downloadLink).toBeVisible({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(readPngDimensions(await readFile(path))).toEqual({ width: 20, height: 30 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});
