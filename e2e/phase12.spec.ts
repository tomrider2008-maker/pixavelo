import { expect, test } from '@playwright/test';

test('Phase 12 publishes immutable build provenance outside the PWA cache', async ({
  page,
  request
}) => {
  const response = await request.get('/release.json');
  expect(response.ok()).toBe(true);
  const release = (await response.json()) as {
    application?: unknown;
    builtAt?: unknown;
    dirty?: unknown;
    revision?: unknown;
    schemaVersion?: unknown;
    version?: unknown;
  };
  expect(release).toMatchObject({
    schemaVersion: 1,
    application: 'pixavelo'
  });
  expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(release.revision).toMatch(/^[a-f0-9]{40}$/);
  expect(Date.parse(String(release.builtAt))).not.toBeNaN();
  expect(typeof release.dirty).toBe('boolean');

  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  expect(await page.evaluate(async () => Boolean(await caches.match('/release.json')))).toBe(false);
});

test('Phase 12 recovers the offline shell after service-worker and cache state are removed', async ({
  browserName,
  context,
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== 'chromium', 'Deterministic recovery probe.');
  const requests: { method: string; url: string }[] = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

  await page.goto('/security');
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
  });
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);

  if (browserName !== 'webkit') {
    await context.setOffline(true);
    try {
      await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Metadata & Privacy' })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  }

  expect(requests.filter((request) => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(
    requests.every((request) => {
      const url = new URL(request.url);
      return url.origin === 'http://127.0.0.1:4173';
    })
  ).toBe(true);
});
