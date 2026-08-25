import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.PIXAVELO_CAPTURE_URL ?? 'http://127.0.0.1:4180';
const outputDirectory = resolve('docs/qa');
const source = await readFile(resolve('docs/design/pixavelo-phase7-editor-sample.png'));
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
try {
  await capture('phase7-editor-desktop.jpg', { width: 1536, height: 1024 });
  await capture('phase7-editor-mobile.jpg', {
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
  const consoleIssues = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  await page.goto(`${baseUrl}/edit`);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'campaign-hero.png',
    mimeType: 'image/png',
    buffer: source
  });
  await page.getByTestId('editor-preview-surface').waitFor({ state: 'visible' });
  await page
    .getByRole('navigation', { name: 'Editor tools' })
    .getByRole('button', { name: 'Adjust' })
    .click();
  await page.getByRole('slider', { name: 'Exposure' }).waitFor({ state: 'visible' });
  await page.screenshot({
    path: resolve(outputDirectory, filename),
    type: 'jpeg',
    quality: 91,
    fullPage: false
  });
  if (consoleIssues.length > 0) {
    throw new Error(`${filename} logged console issues:\n${consoleIssues.join('\n')}`);
  }
  await context.close();
}
