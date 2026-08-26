import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function studioSource(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable.');
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#3157f6';
    context.fillRect(120, 90, 400, 300);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (output) => (output ? resolve(output) : reject(new Error('PNG encode failed.'))),
        'image/png'
      )
    );
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  return Buffer.from(bytes);
}

async function openStudio(page: Page) {
  await page.goto('/resize');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'studio-source.png',
    mimeType: 'image/png',
    buffer: await studioSource(page)
  });
}

test('Phase 15 applies premium transforms locally and invalidates stale output', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(
    testInfo.project.name !== 'chromium',
    'One deterministic processing probe is sufficient.'
  );
  const requests: { readonly method: string; readonly url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await openStudio(page);
  await expect(page.getByRole('toolbar', { name: 'Canvas tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Output' })).toBeDisabled();

  await page.getByRole('button', { name: 'Smart trim' }).click();
  await expect(page.getByText('Smart trim ready')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Width px', exact: true }).fill('160');
  await page.getByRole('button', { name: 'Rotate right' }).click();
  await page.getByRole('button', { name: 'Flip horizontally' }).click();
  await expect(page.getByRole('button', { name: 'Flip horizontally' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.getByRole('button', { name: 'Apply resize' }).click();
  await expect(page.getByRole('link', { name: 'Download image' })).toBeVisible({
    timeout: 30_000
  });
  await expect(page.getByText('Output decoded and verified')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Output' })).toBeEnabled();

  await page.getByRole('button', { name: 'Flip vertically' }).click();
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply resize' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Output' })).toBeDisabled();
  const accessibility = await new AxeBuilder({ page })
    .include('.phase5-resize-workspace')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});

test('Phase 15 mobile studio keeps the page contained and touch controls usable', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile layout probe.');
  await openStudio(page);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  expect(
    await page
      .locator('.resize-stage-toolbar button')
      .evaluateAll((buttons) =>
        buttons.every((button) => button.getBoundingClientRect().height >= 42)
      )
  ).toBe(true);
  await expect(page.getByRole('heading', { name: 'Size & crop' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
});
