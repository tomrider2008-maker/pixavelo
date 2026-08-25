/* global document */
import { chromium } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.PIXAVELO_CAPTURE_URL ?? 'http://127.0.0.1:4180';
const outputDirectory = resolve('docs/qa');
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();

try {
  await capture('phase10-utilities-desktop.jpg', { width: 1536, height: 1024 });
  await capture('phase10-utilities-mobile.jpg', {
    width: 426,
    height: 923,
    isMobile: true,
    hasTouch: true
  });
} finally {
  await browser.close();
}

async function capture(filename, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: 'light' });
  const page = await context.newPage();
  const issues = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') issues.push(message.text());
  });
  await page.goto(`${baseUrl}/developer-tools`);
  await page.locator('[data-image-input]').setInputFiles(await sample(page));
  await page.getByRole('heading', { name: 'Watermark settings' }).waitFor();
  await page.screenshot({
    path: resolve(outputDirectory, filename),
    type: 'jpeg',
    quality: 92,
    fullPage: false
  });
  if (issues.length > 0) throw new Error(`${filename}: ${issues.join('\n')}`);
  await context.close();
}

async function sample(page) {
  const buffer = Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.fillStyle = '#cbd9ee';
      context.fillRect(0, 0, 1200, 800);
      context.fillStyle = '#17345e';
      for (let index = 0; index < 8; index += 1) {
        const width = 80 + index * 15;
        const height = 220 + index * 45;
        context.fillRect(70 + index * 135, 700 - height, width, height);
      }
      context.fillStyle = '#315992';
      context.fillRect(0, 690, 1200, 110);
      const blob = await new Promise((resolveBlob, reject) =>
        canvas.toBlob(
          (value) => (value ? resolveBlob(value) : reject(new Error('JPEG encode failed.'))),
          'image/jpeg',
          0.9
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    })
  );
  return { name: 'campaign-master.jpg', mimeType: 'image/jpeg', buffer };
}
