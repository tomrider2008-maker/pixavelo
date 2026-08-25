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
        let state = 0x69a4f17b;
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

function readStoredZipEntries(bytes: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= bytes.byteLength && bytes.readUInt32LE(offset) === 0x04034b50) {
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

test('Phase 6 isolates a failed file, verifies outputs, retries, and exports a valid ZIP', async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'chromium', 'One deterministic engine probe is sufficient.');
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/batch');
  const source = await makePng(page, 96, 64, true);
  await page.locator('[data-batch-image-input]').setInputFiles([
    { name: 'photo.png', mimeType: 'image/png', buffer: source },
    { name: 'cover.png', mimeType: 'image/png', buffer: source },
    { name: 'mark.png', mimeType: 'image/png', buffer: source },
    {
      name: 'corrupt-scan.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    }
  ]);

  const queue = page.getByRole('list', { name: 'Batch queue' });
  await expect(queue.getByText('Waiting', { exact: true })).toHaveCount(3);
  await expect(queue.getByText('Failed', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Start batch' }).click();
  await expect(queue.getByText('Completed', { exact: true })).toHaveCount(3, { timeout: 45_000 });
  await expect(queue.getByText('Failed', { exact: true })).toHaveCount(1);
  await expect(page.getByText('One failed file never stops the queue.')).toBeVisible();

  await page.getByRole('button', { name: 'Details for photo.png' }).click();
  await expect(page.getByRole('dialog', { name: 'Job details for photo.png' })).toContainText(
    'Removal verified'
  );
  await page.getByRole('button', { name: 'Close job details' }).click();

  await page.getByRole('button', { name: 'Retry corrupt-scan.jpg' }).click();
  await expect(queue.getByText('Failed', { exact: true })).toHaveCount(1, { timeout: 30_000 });
  await expect(queue.getByText('Completed', { exact: true })).toHaveCount(3);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP' }).click();
  const downloadPath = await (await downloadPromise).path();
  if (!downloadPath) throw new Error('Batch ZIP download is unavailable.');
  const entries = readStoredZipEntries(await readFile(downloadPath));
  expect([...entries.keys()]).toEqual([
    'photo-web-01.webp',
    'cover-web-02.webp',
    'mark-web-03.webp'
  ]);
  for (const output of entries.values()) {
    expect(output.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(output.subarray(8, 12).toString('ascii')).toBe('WEBP');
  }
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});

test('Phase 6 pause blocks new dispatch, cancel isolates active work, and retry resumes', async ({
  page
}, testInfo) => {
  test.setTimeout(300_000);
  test.skip(testInfo.project.name !== 'chromium', 'Queue timing probe runs once.');
  await page.goto('/batch');
  const source = await makePng(page, 1200, 900, true);
  await page.locator('[data-batch-image-input]').setInputFiles(
    Array.from({ length: 8 }, (_, index) => ({
      name: `campaign-${String(index + 1).padStart(2, '0')}.png`,
      mimeType: 'image/png',
      buffer: source
    }))
  );
  const queue = page.getByRole('list', { name: 'Batch queue' });
  await expect(queue.getByText('Waiting', { exact: true })).toHaveCount(8);
  await page.getByRole('button', { name: 'Start batch' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume batch' })).toBeVisible();
  await expect(queue.getByText('Waiting', { exact: true })).not.toHaveCount(0);

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(queue.getByText('Cancelled', { exact: true }).first()).toBeVisible({
    timeout: 30_000
  });
  const retryFailed = page.getByRole('button', { name: 'Retry failed' });
  await expect(retryFailed).toBeEnabled({ timeout: 30_000 });
  await retryFailed.click();
  await expect(queue.getByText('Completed', { exact: true })).toHaveCount(8, { timeout: 90_000 });
});

test('Phase 6 virtualizes a 205-file queue without rendering every row', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== 'chromium', 'One DOM virtualization probe is sufficient.');
  await page.goto('/batch');
  const source = await makePng(page, 8, 8);
  await page.locator('[data-batch-image-input]').setInputFiles(
    Array.from({ length: 205 }, (_, index) => ({
      name: `file-${String(index + 1).padStart(3, '0')}.png`,
      mimeType: 'image/png',
      buffer: source
    }))
  );

  const virtualRows = page.locator('[aria-setsize="205"]');
  await expect(virtualRows.first()).toBeVisible();
  expect(await virtualRows.count()).toBeLessThan(30);
  const list = page.getByRole('list', { name: 'Batch queue' });
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect(page.getByText('file-205.png', { exact: true })).toBeVisible();
  expect(await virtualRows.count()).toBeLessThan(30);
});
