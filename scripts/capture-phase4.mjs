import { chromium } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import UTIF from 'utif';

const baseUrl = process.env.PIXAVELO_CAPTURE_URL ?? 'http://127.0.0.1:4174';
const outputDirectory = resolve('docs/qa');
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
try {
  await capture('phase4-desktop.png', { width: 1536, height: 1024 });
  await capture('phase4-mobile.png', { width: 390, height: 844, isMobile: true, hasTouch: true });
} finally {
  await browser.close();
}

async function capture(filename, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/convert`);
  const [heif, avif] = await Promise.all([
    readFile(resolve('e2e/fixtures/hevc32.heif')),
    readFile(resolve('e2e/fixtures/fox.avif'))
  ]);
  await page.locator('[data-image-input]').setInputFiles([
    { name: 'iphone-photo.heif', mimeType: 'image/heif', buffer: heif },
    { name: 'hero.avif', mimeType: 'image/avif', buffer: avif },
    { name: 'brochure.tiff', mimeType: 'image/tiff', buffer: makeTiff() },
    {
      name: 'spinner.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')
    },
    {
      name: 'unsafe-logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/tracker.png"/></svg>'
      )
    }
  ]);
  const queue = page.getByRole('list', { name: 'Conversion queue' });
  await queue.getByText('Ready', { exact: true }).first().waitFor();
  await queue.getByText('Failed', { exact: true }).waitFor();
  await page.getByText('Input capabilities', { exact: true }).click();
  await page.screenshot({ path: resolve(outputDirectory, filename), fullPage: true });
  await context.close();
}

function makeTiff() {
  const rgba = Uint8Array.from([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 0, 255,
    255, 255
  ]);
  return Buffer.from(UTIF.encodeImage(rgba.buffer, 3, 2));
}
