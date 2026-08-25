import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

async function makePng(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 12;
    canvas.height = 8;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable.');
    context.fillStyle = '#1746ed';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (output) => (output ? resolve(output) : reject(new Error('PNG encode failed.'))),
        'image/png'
      );
    });
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  return Buffer.from(bytes);
}

test('Phase 13 holds a new release while the old client has local work', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== 'chromium', 'Deterministic service-worker lifecycle probe.');

  await page.goto('/convert');
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  await page.locator('[data-image-input]').setInputFiles({
    name: 'phase13-pending.png',
    mimeType: 'image/png',
    buffer: await makePng(page)
  });
  await expect(
    page.getByRole('list', { name: 'Conversion queue' }).getByText('Ready', { exact: true })
  ).toBeVisible();

  const workerPath = new URL('../dist/sw.js', import.meta.url);
  const originalWorker = await readFile(workerPath, 'utf8');
  try {
    await page.waitForTimeout(1_000);
    await writeFile(workerPath, `${originalWorker}\n// phase13-next-release\n`);
    await page.evaluate(async () => {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        sessionStorage.setItem('phase13-controller-changed', 'true');
      });
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) throw new Error('Pixavelo service worker is not registered.');
      await registration.update();
      await new Promise<void>((resolve, reject) => {
        if (registration.waiting) {
          resolve();
          return;
        }
        const worker = registration.installing;
        if (!worker) {
          reject(new Error('The simulated new release did not install.'));
          return;
        }
        const timeout = window.setTimeout(
          () => reject(new Error('The simulated new release did not enter waiting.')),
          15_000
        );
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && registration.waiting) {
            window.clearTimeout(timeout);
            resolve();
          }
        });
      });
    });

    await expect(page.getByText('New version available', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Update when finished' }).click();
    await expect(page.getByRole('button', { name: 'Update queued' })).toBeDisabled();
    await expect(page.getByText('phase13-pending.png', { exact: true })).toBeVisible();

    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Remove selected' }).click();
    await reloaded;

    await expect(page.getByRole('heading', { name: 'Convert images' })).toBeVisible();
    await expect(page.getByText('phase13-pending.png', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('phase13-controller-changed'))).toBe(
      'true'
    );
  } finally {
    await writeFile(workerPath, originalWorker);
  }
});
