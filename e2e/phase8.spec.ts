import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);

test('Phase 8 inspects private metadata and gates download on verified cleaning', async ({
  page
}) => {
  const outboundImageRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.postDataBuffer())
      outboundImageRequests.push(request.url());
  });

  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Metadata & Privacy' })).toBeVisible();
  const source = await metadataBearingJpeg(page);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'phase8-private-travel.jpg',
    mimeType: 'image/jpeg',
    buffer: source
  });

  await expect(page.getByRole('heading', { name: 'Private information' })).toBeVisible();
  await expect(
    page.locator('.privacy-signal-list li').filter({ hasText: 'GPS Location' })
  ).toContainText('Present');
  await expect(
    page.locator('.privacy-signal-list li').filter({ hasText: 'Camera Model' })
  ).toContainText('Present');
  await expect(page.getByRole('tabpanel')).toContainText('8 bits/channel');

  await page.getByRole('tab', { name: 'EXIF' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('ACME');
  await expect(page.getByRole('tabpanel')).toContainText('CAM-100');
  await page.getByRole('tab', { name: 'GPS' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('37.808333');

  await page.getByRole('radio', { name: /Remove location only/ }).check();
  await page.locator('.privacy-export').click();
  await expect(page.getByRole('heading', { name: 'Output verified' })).toBeVisible();
  await expect(page.locator('.verification-result')).toContainText('Pixel-preserving rewrite');
  await expect(page.locator('.verification-result')).toContainText('Location & GPS');
  await expect(page.locator('.privacy-export')).toHaveAccessibleName('Download verified image');
  await expect(page.locator('.privacy-export')).toBeVisible();

  await page.getByRole('radio', { name: /Remove all metadata/ }).check();
  await page.locator('.privacy-export').click();
  await expect(page.locator('.verification-result')).toContainText('Local re-encode');
  await expect(page.locator('.toast').last().getByText('Metadata removal verified')).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(outboundImageRequests).toEqual([]);
});

test('Phase 8 mobile keeps scan, inspector, policy and export controls reachable', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile responsive assertion');
  await page.goto('/privacy?action=remove-gps');
  const source = await metadataBearingJpeg(page, 640, 426);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'mobile-private.jpg',
    mimeType: 'image/jpeg',
    buffer: source
  });

  await expect(page.getByRole('heading', { name: 'Private information' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Metadata sections' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Privacy controls' })).toBeVisible();
  await expect(page.locator('.privacy-export')).toContainText('Remove location metadata');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toContainText(
    'Privacy'
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});

async function metadataBearingJpeg(page: Page, width = 1200, height = 800) {
  const pixels = Buffer.from(
    await page.evaluate(
      async ({ imageWidth, imageHeight }) => {
        const canvas = document.createElement('canvas');
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable.');
        context.fillStyle = '#d8e8ff';
        context.fillRect(0, 0, imageWidth, imageHeight);
        context.fillStyle = '#25467f';
        context.beginPath();
        context.moveTo(0, imageHeight);
        context.lineTo(imageWidth * 0.35, imageHeight * 0.32);
        context.lineTo(imageWidth * 0.62, imageHeight);
        context.fill();
        context.fillStyle = '#16345e';
        context.beginPath();
        context.moveTo(imageWidth * 0.3, imageHeight);
        context.lineTo(imageWidth * 0.72, imageHeight * 0.22);
        context.lineTo(imageWidth, imageHeight);
        context.fill();
        context.fillStyle = '#f7fbff';
        context.beginPath();
        context.moveTo(imageWidth * 0.6, imageHeight * 0.4);
        context.lineTo(imageWidth * 0.72, imageHeight * 0.22);
        context.lineTo(imageWidth * 0.81, imageHeight * 0.39);
        context.fill();
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (output) => (output ? resolve(output) : reject(new Error('JPEG encode failed.'))),
            'image/jpeg',
            0.9
          )
        );
        return [...new Uint8Array(await blob.arrayBuffer())];
      },
      { imageWidth: width, imageHeight: height }
    )
  );
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), buildExifTiff()]);
  const xmp = Buffer.from(
    'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description photoshop:City="Yangon" xmp:CreatorTool="Pixavelo Test"/></x:xmpmeta>',
    'binary'
  );
  const iptc = Buffer.from([0x1c, 0x02, 0x5a, 0x00, 0x06, ...Buffer.from('Yangon')]);
  return Buffer.concat([
    pixels.subarray(0, 2),
    jpegSegment(0xe1, exif),
    jpegSegment(0xe1, xmp),
    jpegSegment(0xe2, Buffer.from('ICC_PROFILE\0test-profile', 'binary')),
    jpegSegment(0xed, iptc),
    pixels.subarray(2)
  ]);
}

function buildExifTiff() {
  const bytes = Buffer.alloc(320);
  bytes.write('II', 0, 'ascii');
  bytes.writeUInt16LE(42, 2);
  bytes.writeUInt32LE(8, 4);
  const entries = [
    [0x010f, 2, 5, 100],
    [0x0110, 2, 8, 108],
    [0x0131, 2, 13, 120],
    [0x013b, 2, 10, 136],
    [0x8769, 4, 1, 160],
    [0x8825, 4, 1, 190]
  ];
  writeIfd(bytes, 8, entries);
  bytes.write('ACME\0', 100, 'binary');
  bytes.write('CAM-100\0', 108, 'binary');
  bytes.write('Studio 4.2\0', 120, 'binary');
  bytes.write('Test User\0', 136, 'binary');
  writeIfd(bytes, 160, [[0x9003, 2, 20, 296]]);
  bytes.write('2026:08:25 10:30:00\0', 296, 'binary');
  bytes.writeUInt16LE(4, 190);
  writeEntry(bytes, 192, 0x0001, 2, 2, 0x004e);
  writeEntry(bytes, 204, 0x0002, 5, 3, 248);
  writeEntry(bytes, 216, 0x0003, 2, 2, 0x0045);
  writeEntry(bytes, 228, 0x0004, 5, 3, 272);
  bytes.writeUInt32LE(0, 240);
  writeRationals(bytes, 248, [
    [37, 1],
    [48, 1],
    [30, 1]
  ]);
  writeRationals(bytes, 272, [
    [96, 1],
    [9, 1],
    [0, 1]
  ]);
  return bytes;
}

function writeIfd(bytes: Buffer, offset: number, entries: number[][]) {
  bytes.writeUInt16LE(entries.length, offset);
  entries.forEach((entry, index) => writeEntry(bytes, offset + 2 + index * 12, ...entry));
  bytes.writeUInt32LE(0, offset + 2 + entries.length * 12);
}

function writeEntry(bytes: Buffer, offset: number, tag = 0, type = 0, count = 0, value = 0) {
  bytes.writeUInt16LE(tag, offset);
  bytes.writeUInt16LE(type, offset + 2);
  bytes.writeUInt32LE(count, offset + 4);
  bytes.writeUInt32LE(value, offset + 8);
}

function writeRationals(bytes: Buffer, offset: number, values: number[][]) {
  values.forEach(([numerator = 0, denominator = 1], index) => {
    bytes.writeUInt32LE(numerator, offset + index * 8);
    bytes.writeUInt32LE(denominator, offset + index * 8 + 4);
  });
}

function jpegSegment(marker: number, payload: Buffer) {
  const header = Buffer.from([
    0xff,
    marker,
    ((payload.length + 2) >>> 8) & 0xff,
    (payload.length + 2) & 0xff
  ]);
  return Buffer.concat([header, payload]);
}
