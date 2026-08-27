import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.setTimeout(90_000);

async function makePng(page: Page, width = 48, height = 32) {
  const bytes = await page.evaluate(
    async ({ imageWidth, imageHeight }) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.fillStyle = '#1746ed';
      context.fillRect(0, 0, imageWidth, imageHeight);
      context.fillStyle = '#8aa2ff';
      context.fillRect(imageWidth / 2, 0, imageWidth / 2, imageHeight);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (output) => (output ? resolve(output) : reject(new Error('PNG encode failed.'))),
          'image/png'
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { imageWidth: width, imageHeight: height }
  );
  return Buffer.from(bytes);
}

async function makeRetouchPng(page: Page, width = 120, height = 120) {
  const bytes = await page.evaluate(
    async ({ imageWidth, imageHeight }) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.fillStyle = '#1c5fd4';
      context.fillRect(0, 0, imageWidth, imageHeight);
      context.fillStyle = '#ef3340';
      context.fillRect(
        imageWidth * 0.42,
        imageHeight * 0.42,
        imageWidth * 0.16,
        imageHeight * 0.16
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (output) => (output ? resolve(output) : reject(new Error('PNG encode failed.'))),
          'image/png'
        )
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { imageWidth: width, imageHeight: height }
  );
  return Buffer.from(bytes);
}

async function downloadedPixels(page: Page, path: string) {
  const bytes = [...(await readFile(path))];
  return page.evaluate(async (source) => {
    const bitmap = await createImageBitmap(
      new Blob([Uint8Array.from(source)], { type: 'image/png' })
    );
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable.');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const read = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
    return {
      corner: read(1, 1),
      center: read(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2))
    };
  }, bytes);
}

test('Phase 7 editor keeps preview edits non-destructive until verified export', async ({
  page
}) => {
  await page.goto('/edit');
  const source = await makePng(page);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'phase7-source.png',
    mimeType: 'image/png',
    buffer: source
  });

  await expect(page.getByRole('heading', { name: 'Image Editor' })).toBeVisible();
  await expect(page.getByTestId('editor-preview-surface')).toBeVisible();
  await expect(page.getByTestId('editor-encoding-state')).toContainText('Encodes on export');
  await expect(page.getByRole('link', { name: 'Download again' })).toHaveCount(0);

  await page
    .getByRole('navigation', { name: 'Editor tools' })
    .getByRole('button', { name: 'Flip' })
    .click();
  const horizontal = page.getByRole('button', { name: 'Horizontal' });
  await horizontal.click();
  await expect(horizontal).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Original preserved', { exact: false })).toContainText('1 edit');
  await expect(page.getByTestId('editor-encoding-state')).toContainText('Encodes on export');

  await page.keyboard.press('Control+z');
  await expect(horizontal).toHaveAttribute('aria-pressed', 'false');

  await page
    .getByRole('navigation', { name: 'Editor tools' })
    .getByRole('button', { name: 'Adjust' })
    .click();
  await page.getByRole('checkbox', { name: 'Grayscale' }).check();
  await expect(page.getByRole('checkbox', { name: 'Grayscale' })).toBeChecked();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(
    page.locator('.editor-history-panel li').filter({ hasText: 'Grayscale' })
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Adjust' }).click();
  await page.getByLabel('Comparison mode').filter({ visible: true }).first().selectOption('output');
  await expect(page.getByRole('button', { name: '200%' })).toBeVisible();
  await page.getByRole('button', { name: '200%' }).click();
  await expect(page.getByRole('button', { name: '200%' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('combobox', { name: 'Format' }).selectOption('png');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export image' }).click();
  await download;
  await expect(page.getByRole('link', { name: 'Download again' })).toBeVisible();
  await expect(page.getByTestId('editor-encoding-state')).not.toContainText('Encodes on export');
  await expect(page.getByText('Edited image exported')).toBeVisible();
});

test('Phase 7 mobile editor keeps canvas, tools, inspector and export reachable', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile responsive assertion');
  await page.goto('/edit');
  const source = await makePng(page);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'mobile-source.png',
    mimeType: 'image/png',
    buffer: source
  });

  await expect(page.getByRole('button', { name: 'Export image' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Editor tools' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Editor controls' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toContainText('Edit');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('Editor adjustment labels stay clear of their sliders on compact desktop panels', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop inspector geometry assertion.');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/edit');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'label-clearance.png',
    mimeType: 'image/png',
    buffer: await makePng(page)
  });

  const temperature = page.locator('.editor-range-control').filter({ hasText: 'Temperature' });
  const label = temperature.locator('> span');
  const slider = temperature.getByRole('slider');
  const [labelBox, sliderBox] = await Promise.all([label.boundingBox(), slider.boundingBox()]);

  if (!labelBox || !sliderBox) throw new Error('Temperature control geometry was unavailable.');
  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(sliderBox.x + 1);

  await slider.press('ArrowRight');
  await expect(temperature.locator('output')).toHaveText('1');
});

test('Premium editor analysis, looks and production presets remain local and reversible', async ({
  page
}) => {
  const nonGetRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') nonGetRequests.push(`${request.method()} ${request.url()}`);
  });
  await page.goto('/edit');
  const source = await makePng(page, 120, 80);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'premium-editor-source.png',
    mimeType: 'image/png',
    buffer: source
  });

  await expect(page.getByRole('img', { name: 'RGB luminance histogram' })).toBeVisible();
  const autoTone = page.getByRole('button', { name: /Auto Tone/ });
  await expect(autoTone).toBeEnabled();
  await page.getByRole('button', { name: 'Vivid' }).click();
  await expect(page.getByRole('button', { name: 'Vivid' })).toHaveAttribute('aria-pressed', 'true');
  await autoTone.click();

  await page
    .getByRole('navigation', { name: 'Editor tools' })
    .getByRole('button', { name: 'Crop' })
    .click();
  await page.getByRole('button', { name: '4:5' }).click();
  await page
    .getByRole('navigation', { name: 'Editor tools' })
    .getByRole('button', { name: 'Canvas' })
    .click();
  await page.getByRole('button', { name: /Portrait/ }).click();
  await expect(page.locator('.editor-output-controls')).toContainText('1080 × 1350');

  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.locator('.editor-history-panel')).toContainText('Auto tone');
  await expect(page.locator('.editor-history-panel')).toContainText('Aspect crop');
  await expect(page.locator('.editor-history-panel')).toContainText('Portrait canvas');
  expect(nonGetRequests).toEqual([]);
});

test('Remove and Heal reconstructs painted pixels locally in the downloaded image', async ({
  page
}) => {
  const requests: { method: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto('/edit');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'local-heal.png',
    mimeType: 'image/png',
    buffer: await makeRetouchPng(page)
  });

  await page
    .getByRole('navigation', { name: 'Editor tools' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await page.getByLabel('Brush').fill('24');
  const overlay = page.getByRole('application', { name: 'Remove and heal image canvas' });
  const bounds = await overlay.boundingBox();
  if (!bounds) throw new Error('Remove overlay geometry was unavailable.');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 2, bounds.y + bounds.height / 2 + 2);
  await page.mouse.up();

  await expect(page.getByText('1 pending')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply edits first' })).toBeDisabled();
  await page.getByRole('button', { name: 'Apply removal' }).click();
  await page.getByRole('combobox', { name: 'Format' }).selectOption('png');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export image' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Downloaded heal output was unavailable.');
  const pixels = await downloadedPixels(page, path);
  expect(pixels.center[0]).toBeLessThan(100);
  expect(pixels.center[2]).toBeGreaterThan(120);
  assertLocalRequests(requests, page.url());
});

test('Background Cutout creates a real transparent PNG without AI or uploads', async ({ page }) => {
  const requests: { method: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto('/edit');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'local-cutout.png',
    mimeType: 'image/png',
    buffer: await makeRetouchPng(page)
  });

  await page
    .getByRole('navigation', { name: 'Editor tools' })
    .getByRole('button', { name: 'Cutout' })
    .click();
  const accessibility = await new AxeBuilder({ page })
    .include('.editor-page')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    accessibility.violations,
    accessibility.violations.map(({ id, help }) => `${id}: ${help}`).join('\n')
  ).toEqual([]);
  const overlay = page.getByRole('application', { name: 'Background cutout image canvas' });
  await overlay.focus();
  await overlay.press('Home');
  await overlay.press('Enter');

  await expect(page.getByText('1 pending')).toBeVisible();
  await page.getByRole('button', { name: 'Apply cutout' }).click();
  await expect(page.getByRole('combobox', { name: 'Format' })).toHaveValue('png');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export image' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Downloaded cutout output was unavailable.');
  const pixels = await downloadedPixels(page, path);
  expect(pixels.corner[3]).toBe(0);
  expect(pixels.center[3]).toBeGreaterThan(240);
  assertLocalRequests(requests, page.url());
});

function assertLocalRequests(
  requests: readonly { method: string; url: string }[],
  currentUrl: string
) {
  const origin = new URL(currentUrl).origin;
  expect(requests.filter(({ method }) => method !== 'GET' && method !== 'HEAD')).toEqual([]);
  expect(
    requests
      .map(({ url }) => new URL(url))
      .filter(({ protocol }) => protocol === 'http:' || protocol === 'https:')
      .every((url) => url.origin === origin)
  ).toBe(true);
}
