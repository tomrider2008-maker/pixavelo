import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

interface ObservedRequest {
  readonly method: string;
  readonly url: string;
}

test.use({ storageState: { cookies: [], origins: [] } });

test('first visit is accessible, dismissible, and remembered locally', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');

  const dialog = page.getByRole('dialog', { name: 'Welcome to Pixavelo' });
  const workspace = page.locator('.app-shell__workspace');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close welcome guide' })).toBeFocused();
  await expect(workspace).toHaveAttribute('inert', '');
  await expect(workspace).toHaveAttribute('aria-hidden', 'true');

  const audit = await new AxeBuilder({ page })
    .include('.welcome-dialog')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);

  await page.getByRole('button', { name: 'Continue to dashboard' }).click();
  await expect(dialog).toBeHidden();
  await expect(workspace).not.toHaveAttribute('inert', '');
  await expect(workspace).not.toHaveAttribute('aria-hidden', 'true');
  expect(await page.evaluate(() => localStorage.getItem('pixavelo:welcome:v1'))).toBe(
    '{"dismissed":true}'
  );

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose Images', exact: true }).click();
  expect((await fileChooserPromise).isMultiple()).toBe(true);

  await page.reload();
  await expect(dialog).toBeHidden();
});

test('Settings can reopen the guide without losing focus or opening stacked dialogs', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile-'), 'Desktop keyboard integration probe.');
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue to dashboard' }).click();
  await page.goto('/settings');

  const reopen = page.getByRole('button', { name: 'Reopen welcome guide' });
  await reopen.click();
  await expect(page.getByRole('dialog', { name: 'Welcome to Pixavelo' })).toBeVisible();
  await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Meta+k' : 'Control+k');
  await expect(page.locator('.command-palette')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(reopen).toBeFocused();

  await reopen.click();
  await page
    .getByRole('dialog', { name: 'Welcome to Pixavelo' })
    .getByLabel('Choose image files')
    .setInputFiles({
      name: 'focus-return.png',
      mimeType: 'image/png',
      buffer: await makePng(page)
    });
  await expect(page.getByRole('dialog', { name: 'Choose the right studio' })).toBeVisible();
  await page.getByRole('button', { name: 'Close smart intake' }).click();
  await expect(reopen).toBeFocused();

  await reopen.click();
  await page.getByRole('link', { name: /optimize/i }).click();
  await expect(page).toHaveURL(/\/optimize$/);
});

test('mobile welcome is contained and keeps comfortable interactive targets', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile containment probe.');
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Welcome to Pixavelo' })).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);

  const smallTargets = await page
    .locator('.welcome-dialog a, .welcome-dialog button')
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { label: element.textContent.trim() || element.getAttribute('aria-label'), rect };
        })
        .filter(
          ({ rect }) => rect.width > 0 && rect.height > 0 && (rect.width < 42 || rect.height < 42)
        )
    );
  expect(smallTargets).toEqual([]);
});

test('welcome intake validates locally and hands the file to the selected studio', async ({
  page
}) => {
  const requests = observeRequests(page);
  await page.goto('/');

  const welcome = page.getByRole('dialog', { name: 'Welcome to Pixavelo' });
  await welcome.getByLabel('Choose image files').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: await makePng(page)
  });
  await expect(page.getByRole('dialog', { name: 'Choose the right studio' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open Image Editor' })).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();

  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByRole('navigation', { name: 'Editor tools' })).toBeVisible();
  await expect(page.getByLabel('RGB luminance histogram')).toBeVisible();
  await expect(page.getByTestId('editor-encoding-state')).toContainText('Encodes on export');
  await expect(page.locator('.editor-commandbar__identity')).toContainText(
    '320 × 220 · Saved locally'
  );
  await expect(page.getByText('This image could not be opened', { exact: true })).toHaveCount(0);
  expectOnlySameOriginReads(requests, new URL(page.url()).origin);
});

test('same-route welcome intake reaches an already mounted studio', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Critical same-route session regression probe.');
  const requests = observeRequests(page);
  await page.goto('/edit');

  await page
    .getByRole('dialog', { name: 'Welcome to Pixavelo' })
    .getByLabel('Choose image files')
    .setInputFiles({
      name: 'same-route.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 360, 240)
    });
  const intake = page.getByRole('dialog', { name: 'Choose the right studio' });
  await expect(intake.getByRole('heading', { name: 'Open Image Editor' })).toBeVisible();
  await intake.getByRole('button', { name: /continue/i }).click();

  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.locator('.editor-commandbar__identity')).toContainText(
    '360 × 240 · Saved locally'
  );
  await expect(page.getByRole('button', { name: 'same-route.png', exact: true })).toBeVisible();
  expectOnlySameOriginReads(requests, new URL(page.url()).origin);
});

test('dashboard keyboard intake hands a validated image to a non-editor studio', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile-'), 'Desktop keyboard file-picker probe.');
  const requests = observeRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue to dashboard' }).click();

  const source = await makePng(page, 640, 480);
  const dropZone = page.getByRole('button', { name: 'Choose or drop image files' });
  await dropZone.focus();
  await expect(dropZone).toBeFocused();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (
    await fileChooserPromise
  ).setFiles({
    name: 'dashboard-intake.png',
    mimeType: 'image/png',
    buffer: source
  });

  const intake = page.getByRole('dialog', { name: 'Choose the right studio' });
  await expect(intake).toBeVisible();
  await expect(intake.getByRole('heading', { name: 'Open Image Editor' })).toBeVisible();
  await intake.getByRole('button', { name: /^Optimize\b/ }).click();

  await expect(page).toHaveURL(/\/optimize$/);
  await expect(page.getByText('dashboard-intake.png', { exact: true })).toBeVisible();
  await expect(page.getByText('Ready to measure', { exact: true })).toBeVisible();
  expectOnlySameOriginReads(requests, new URL(page.url()).origin);
});

test('dashboard intake initializes Resize from the real source geometry', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Critical Resize handoff regression probe.');
  const requests = observeRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue to dashboard' }).click();

  await page.locator('.dashboard-page [data-image-input]').setInputFiles({
    name: 'resize-handoff.png',
    mimeType: 'image/png',
    buffer: await makePng(page)
  });

  const intake = page.getByRole('dialog', { name: 'Choose the right studio' });
  await expect(intake).toBeVisible();
  await intake.getByRole('button', { name: /^Resize\b/ }).click();

  await expect(page).toHaveURL(/\/resize$/);
  await expect(page.getByRole('spinbutton', { name: 'Width px', exact: true })).toHaveValue('320');
  await expect(page.getByRole('spinbutton', { name: 'Height px', exact: true })).toHaveValue('220');
  await expect(page.getByRole('button', { name: /Original\s*320 × 220/ })).toBeVisible();
  await expect(page.locator('.resize-output-strip')).toContainText('320 × 220');
  await expect(page.getByRole('group', { name: 'Interactive crop preview' })).toHaveCSS(
    'aspect-ratio',
    '320 / 220'
  );
  expect(
    await page.locator('.crop-selection').evaluate((element) => {
      const style = (element as HTMLElement).style;
      return { left: style.left, top: style.top, width: style.width, height: style.height };
    })
  ).toEqual({ left: '0%', top: '0%', width: '100%', height: '100%' });
  expectOnlySameOriginReads(requests, new URL(page.url()).origin);
});

function observeRequests(page: Page): ObservedRequest[] {
  const requests: ObservedRequest[] = [];
  page.on('request', (request) => {
    requests.push({ method: request.method(), url: request.url() });
  });
  return requests;
}

function expectOnlySameOriginReads(requests: readonly ObservedRequest[], expectedOrigin: string) {
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(
    requests.filter((request) => {
      const url = new URL(request.url);
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== expectedOrigin;
    })
  ).toEqual([]);
}

async function makePng(page: Page, width = 320, height = 220): Promise<Buffer> {
  const bytes = await page.evaluate(
    async ({ imageWidth, imageHeight }) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      context.fillStyle = '#3157f6';
      context.fillRect(0, 0, imageWidth, imageHeight);
      context.fillStyle = '#f8fafc';
      context.fillRect(24, 24, Math.max(1, imageWidth - 48), Math.max(1, imageHeight - 48));
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('PNG encode failed.'))),
          'image/png'
        );
      });
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { imageWidth: width, imageHeight: height }
  );
  return Buffer.from(bytes);
}
