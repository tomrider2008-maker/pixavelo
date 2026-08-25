import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function makePng(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 12;
    canvas.height = 8;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable.');
    context.fillStyle = 'rgba(23, 70, 237, 0.7)';
    context.fillRect(0, 0, 12, 8);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Encode failed.'))),
        'image/png'
      );
    });
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  return Buffer.from(bytes);
}

async function makePrivacyPng(page: Page) {
  const source = await makePng(page);
  const keyword = Buffer.from('XML:com.adobe.xmp\0', 'binary');
  const controls = Buffer.from([0, 0, 0, 0, 0]);
  const xmp = Buffer.from(
    '<x:xmpmeta><rdf:Description photoshop:City="Yangon"/></x:xmpmeta>',
    'utf8'
  );
  const payload = Buffer.concat([keyword, controls, xmp]);
  const type = Buffer.from('iTXt', 'ascii');
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0);
  type.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, chunk.length - 4)), chunk.length - 4);
  return Buffer.concat([source.subarray(0, -12), chunk, source.subarray(-12)]);
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function expectImageSignature(bytes: Buffer, mime: 'image/jpeg' | 'image/webp') {
  if (mime === 'image/jpeg') {
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    return;
  }
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
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

test('production shell, deep routes, manifest and security policy are healthy', async ({
  browserName,
  page,
  request
}) => {
  test.setTimeout(60_000);
  const browserErrors: string[] = [];
  let ignoredFirefoxDiagnostics = 0;
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const source = message.location();
      const isSourceLessFirefoxRuntimeDiagnostic =
        browserName === 'firefox' &&
        !source.url &&
        message.text() ===
          '[JavaScript Error: "InvalidStateError: An attempt was made to use an object that is not, or is no longer, usable"]';
      if (isSourceLessFirefoxRuntimeDiagnostic) {
        ignoredFirefoxDiagnostics += 1;
        return;
      }
      browserErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).not.toContain('unsafe-eval');
  expect(headers['content-security-policy']).not.toContain('wasm-unsafe-eval');
  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
  expect(headers['cross-origin-resource-policy']).toBe('same-origin');
  await expect(
    page.getByRole('heading', { name: 'Powerful image tools. Completely private.' })
  ).toBeVisible();

  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.status()).toBe(200);
  const manifest = (await manifestResponse.json()) as { name?: unknown };
  expect(manifest.name).toBe('Pixavelo — Private Image Processing Studio');

  const releaseResponse = await request.get('/release.json');
  expect(releaseResponse.status()).toBe(200);
  expect(releaseResponse.headers()['cache-control']).toContain('no-store');
  const release = (await releaseResponse.json()) as {
    dirty?: unknown;
    revision?: unknown;
    schemaVersion?: unknown;
    version?: unknown;
  };
  expect(release.schemaVersion).toBe(1);
  expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(release.revision).toMatch(/^[a-f0-9]{40}$/);
  expect(release.dirty).toBe(false);

  const privacyResponse = await page.goto('/privacy');
  expect(privacyResponse?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Metadata & Privacy' })).toBeVisible();
  await page.goto('/web-assets');
  await expect(page.getByRole('heading', { name: 'Web Asset Studio' })).toBeVisible();
  await page.goto('/developer-tools');
  await expect(page.getByRole('heading', { name: 'Professional Utilities' })).toBeVisible();
  await page.goto('/security');
  await expect(page.getByRole('heading', { name: 'Security design' })).toBeVisible();
  expect(browserErrors).toEqual([]);
  if (ignoredFirefoxDiagnostics > 0) {
    test.info().annotations.push({
      type: 'firefox-runtime-diagnostic',
      description: `Ignored ${ignoredFirefoxDiagnostics} source-less Firefox InvalidStateError diagnostics.`
    });
  }
});

test('production performs a verified universal conversion and ZIP export without uploads', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'chromium', 'One production engine probe is sufficient.');
  const requests: { method: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/convert');
  const source = await makePng(page);
  await page.locator('[data-image-input]').setInputFiles([
    { name: 'production-a.png', mimeType: 'image/png', buffer: source },
    { name: 'production-b.png', mimeType: 'image/png', buffer: source }
  ]);
  const queue = page.getByRole('list', { name: 'Conversion queue' });
  await expect(queue.getByText('Ready', { exact: true })).toHaveCount(2);
  await page.getByLabel('Preset').selectOption('web-delivery');
  await page.getByLabel('Naming pattern').fill('{name}-{index}');
  await page.getByLabel('Output format for production-a.png').selectOption('jpeg');
  await page.getByRole('button', { name: 'Process all' }).click();
  await expect(queue.getByText('Completed', { exact: true })).toHaveCount(2, { timeout: 20_000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pixavelo-converted-\d{4}-\d{2}-\d{2}\.zip$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const entries = readStoredZipEntries(await readFile(downloadPath));
  expect([...entries.keys()]).toEqual(['production-a-01.jpg', 'production-b-02.webp']);
  expectImageSignature(entries.get('production-a-01.jpg') ?? Buffer.alloc(0), 'image/jpeg');
  expectImageSignature(entries.get('production-b-02.webp') ?? Buffer.alloc(0), 'image/webp');

  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(
    requests.every((request) => {
      const url = new URL(request.url);
      return (
        url.hostname === 'pixavelo.pages.dev' ||
        (url.protocol === 'blob:' && request.url.startsWith('blob:https://pixavelo.pages.dev/'))
      );
    })
  ).toBe(true);
});

test('production Phase 5 compression and resize routes produce verified files', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== 'chromium', 'One production engine probe is sufficient.');
  const requests: { method: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  const source = await makePng(page);
  await page.goto('/optimize?preset=500kb');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'production-optimize.png',
    mimeType: 'image/png',
    buffer: source
  });
  await expect(page.getByText('Ready to measure')).toBeVisible();
  await page.getByRole('button', { name: 'Compress image' }).click();
  const optimizedLink = page.getByRole('link', { name: 'Download optimized image' });
  await expect(optimizedLink).toBeVisible({ timeout: 20_000 });
  const optimizedDownload = page.waitForEvent('download');
  await optimizedLink.click();
  const optimizedPath = await (await optimizedDownload).path();
  expect(optimizedPath).not.toBeNull();
  const optimized = await readFile(optimizedPath);
  expect(optimized.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(optimized.subarray(8, 12).toString('ascii')).toBe('WEBP');

  await page.goto('/resize');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'production-transform.png',
    mimeType: 'image/png',
    buffer: source
  });
  await page.getByRole('spinbutton', { name: 'Width' }).fill('6');
  await expect(page.getByRole('spinbutton', { name: 'Height' })).toHaveValue('4');
  await page.getByRole('button', { name: '90°' }).click();
  await page.getByRole('button', { name: 'Apply resize' }).click();
  const transformedLink = page.getByRole('link', { name: 'Download resized image' });
  await expect(transformedLink).toBeVisible({ timeout: 20_000 });
  const transformedDownload = page.waitForEvent('download');
  await transformedLink.click();
  const transformedPath = await (await transformedDownload).path();
  expect(transformedPath).not.toBeNull();
  const transformed = await readFile(transformedPath);
  expect([...transformed.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(transformed.readUInt32BE(16)).toBe(4);
  expect(transformed.readUInt32BE(20)).toBe(6);
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});

test('production Phase 7 editor preserves the source until explicit verified export', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'chromium', 'One production engine probe is sufficient.');
  const requests: { method: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/edit');
  const source = await makePng(page);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'production-editor.png',
    mimeType: 'image/png',
    buffer: source
  });

  await expect(page.getByRole('heading', { name: 'Image Editor' })).toBeVisible();
  await expect(page.getByTestId('editor-encoding-state')).toContainText('Encodes on export');
  await page
    .getByRole('navigation', { name: 'Editor tools' })
    .getByRole('button', { name: 'Adjust' })
    .click();
  await page.getByRole('checkbox', { name: 'Grayscale' }).check();
  await expect(page.getByText('Original preserved', { exact: false })).toContainText('1 edit');
  await expect(page.getByRole('link', { name: 'Download again' })).toHaveCount(0);

  await page.getByRole('combobox', { name: 'Format' }).selectOption('png');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export image' }).click();
  const downloadPath = await (await downloadPromise).path();
  expect(downloadPath).not.toBeNull();
  const output = await readFile(downloadPath);
  expect([...output.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await expect(page.getByRole('link', { name: 'Download again' })).toBeVisible();
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});

test('production Phase 8 removes location only after output verification', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'chromium', 'One production engine probe is sufficient.');
  const requests: { method: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/privacy?action=remove-gps');
  const source = await makePrivacyPng(page);
  await page.locator('[data-image-input]').setInputFiles({
    name: 'production-private.png',
    mimeType: 'image/png',
    buffer: source
  });
  await expect(
    page.locator('.privacy-signal-list li').filter({ hasText: 'GPS Location' })
  ).toContainText('Present');
  await expect(page.getByRole('link', { name: 'Download verified image' })).toHaveCount(0);
  await page.locator('.privacy-export').click();
  await expect(page.getByRole('heading', { name: 'Output verified' })).toBeVisible();
  await expect(page.locator('.verification-result')).toContainText('Location & GPS');
  await expect(page.locator('.privacy-export')).toHaveAccessibleName('Download verified image');
  await expect(page.locator('.privacy-export')).toBeVisible();
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});

test('production Phase 9 and 10 generate verified local assets and hashes', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== 'chromium', 'One production engine probe is sufficient.');
  const requests: { method: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  const source = await makePng(page);

  await page.goto('/web-assets');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'production-web-asset.png',
    mimeType: 'image/png',
    buffer: source
  });
  for (const width of [768, 1200, 1600]) {
    await page.getByRole('button', { name: `Remove ${width}px breakpoint` }).click();
  }
  await page.getByRole('spinbutton', { name: 'Breakpoint 1 width' }).fill('16');
  await page.getByLabel('AVIF').uncheck();
  await page.getByRole('button', { name: 'Generate assets' }).first().click();
  await expect(page.getByText('Output package verified')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.web-markup-panel')).toContainText('production-web-asset-12.jpg');
  await expect(page.getByRole('link', { name: 'Download ZIP' })).toBeVisible();

  await page.goto('/developer-tools');
  await page.locator('[data-image-input]').setInputFiles({
    name: 'production-hash.png',
    mimeType: 'image/png',
    buffer: source
  });
  await page.getByRole('tab', { name: 'Hash' }).click();
  await page.locator('.developer-tools-heading__actions .button--primary').click();
  await expect(page.locator('.hash-result code')).toHaveText(/^[a-f0-9]{64}$/);
  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
});
