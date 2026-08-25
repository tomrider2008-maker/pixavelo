import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const options = parseArguments(process.argv.slice(2));
const baseUrl = new URL(
  options.baseUrl ?? process.env.PIXAVELO_BASE_URL ?? 'https://pixavelo.pages.dev'
);
if (baseUrl.protocol !== 'https:') throw new Error('Deployment verification requires HTTPS.');
baseUrl.pathname = '/';
baseUrl.search = '';
baseUrl.hash = '';

const expectedRevision =
  options.expectedRevision ?? process.env.PIXAVELO_EXPECTED_REVISION ?? gitRevision();
const reportPath =
  options.report ??
  process.env.PIXAVELO_OPERATION_REPORT ??
  '.artifacts/operations/deployment-verification.json';
const report = {
  schemaVersion: 2,
  target: baseUrl.href.replace(/\/$/, ''),
  checkedAt: new Date().toISOString(),
  expectedRevision: expectedRevision || null,
  release: null,
  startupBytes: 0,
  routeMeasurements: [],
  checks: [],
  failures: []
};

try {
  const routeExpectations = [
    ['/', '<div id="root">'],
    ['/privacy', '<div id="root">'],
    ['/web-assets', '<div id="root">'],
    ['/developer-tools', '<div id="root">'],
    ['/security', '<div id="root">']
  ];
  let indexHtml = '';
  for (const [path, marker] of routeExpectations) {
    const { response, body, durationMs } = await request(path);
    report.routeMeasurements.push({ path, durationMs });
    check(
      response.status === 200,
      `${path} returns HTTP 200`,
      `${path} returned ${response.status}`
    );
    check(
      response.headers.get('content-type')?.includes('text/html'),
      `${path} serves HTML`,
      `${path} returned ${response.headers.get('content-type') ?? 'no content type'}`
    );
    check(
      body.includes(marker),
      `${path} serves the application shell`,
      `${path} shell marker is missing`
    );
    check(durationMs < 5000, `${path} responds within 5 seconds`, `${path} took ${durationMs} ms`);
    if (path === '/') indexHtml = body;
  }

  const rootResponse = await fetchWithRetry(new URL('/', baseUrl));
  for (const [header, expected] of [
    ['content-security-policy', "default-src 'self'"],
    ['strict-transport-security', 'max-age=63072000'],
    ['cross-origin-opener-policy', 'same-origin'],
    ['cross-origin-embedder-policy', 'require-corp'],
    ['cross-origin-resource-policy', 'same-origin'],
    ['referrer-policy', 'no-referrer'],
    ['permissions-policy', 'geolocation=()']
  ]) {
    const value = rootResponse.headers.get(header) ?? '';
    check(value.includes(expected), `${header} is enforced`, `${header} is missing ${expected}`);
  }
  const shellCacheControl = rootResponse.headers.get('cache-control') ?? '';
  check(
    shellCacheControl.includes('no-store') ||
      (shellCacheControl.includes('max-age=0') && shellCacheControl.includes('must-revalidate')),
    'application shell cannot be reused without revalidation',
    `application shell cache policy is unsafe (${shellCacheControl || 'missing'})`
  );

  const releaseResponse = await fetchWithRetry(new URL('/release.json', baseUrl), 10);
  check(
    releaseResponse.status === 200,
    'release provenance is published',
    'release.json is unavailable'
  );
  const release = await releaseResponse.json();
  report.release = release;
  check(release.schemaVersion === 1, 'release schema is supported', 'release schema is invalid');
  check(
    /^\d+\.\d+\.\d+$/.test(release.version),
    'release version is stable semver',
    'release version is invalid'
  );
  check(
    /^[a-f0-9]{40}$/.test(release.revision),
    'release revision is immutable',
    'release revision is invalid'
  );
  check(
    release.dirty === false,
    'production release was built cleanly',
    'production release is marked dirty'
  );
  if (expectedRevision) {
    check(
      revisionsMatch(release.revision, expectedRevision),
      'production revision matches the requested release',
      `expected ${expectedRevision}, received ${release.revision}`
    );
  }
  check(
    (releaseResponse.headers.get('cache-control') ?? '').includes('no-store'),
    'release provenance cannot become stale',
    'release.json cache policy is missing no-store'
  );

  const manifestResponse = await fetchWithRetry(new URL('/manifest.webmanifest', baseUrl));
  const manifest = await manifestResponse.json();
  check(
    manifestResponse.status === 200,
    'PWA manifest is available',
    'PWA manifest is unavailable'
  );
  check(
    manifest.display === 'standalone' && manifest.start_url === '/' && manifest.scope === '/',
    'PWA root scope is intact',
    'PWA manifest scope is invalid'
  );
  const serviceWorkerResponse = await fetchWithRetry(new URL('/sw.js', baseUrl));
  const serviceWorker = await serviceWorkerResponse.text();
  check(
    serviceWorkerResponse.status === 200 && serviceWorker.length > 1000,
    'service worker artifact is available',
    'service worker artifact is missing or unexpectedly small'
  );
  check(
    (serviceWorkerResponse.headers.get('cache-control') ?? '').includes('no-cache'),
    'service worker update checks bypass stale caches',
    'service worker cache policy is missing no-cache'
  );

  const startupAssets = [...indexHtml.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(
    (match) => new URL(match[1], baseUrl)
  );
  check(
    startupAssets.length >= 2,
    'startup assets are discoverable',
    'startup assets were not found'
  );
  for (const assetUrl of startupAssets) {
    check(
      assetUrl.origin === baseUrl.origin,
      `${assetUrl.pathname} is same-origin`,
      `${assetUrl.href} is external`
    );
    const assetResponse = await fetchWithRetry(assetUrl);
    const bytes = Buffer.from(await assetResponse.arrayBuffer());
    report.startupBytes += bytes.byteLength;
    check(
      assetResponse.status === 200,
      `${assetUrl.pathname} is available`,
      `${assetUrl.pathname} failed`
    );
    const assetCacheControl = assetResponse.headers.get('cache-control') ?? '';
    if (assetUrl.pathname.startsWith('/assets/')) {
      check(
        assetCacheControl.includes('immutable'),
        `${assetUrl.pathname} is immutable`,
        `${assetUrl.pathname} cache policy is not immutable`
      );
    } else {
      check(
        assetUrl.pathname === '/registerSW.js' && assetCacheControl.includes('no-cache'),
        `${assetUrl.pathname} always revalidates`,
        `${assetUrl.pathname} cache policy is unsafe (${assetCacheControl || 'missing'})`
      );
    }
  }
  check(
    report.startupBytes <= 600 * 1024,
    'startup transfer stays within 600 KiB',
    `startup transfer is ${report.startupBytes} bytes`
  );
} catch (error) {
  report.failures.push(error instanceof Error ? error.message : String(error));
}

await mkdir(dirname(resolve(reportPath)), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (report.failures.length > 0) {
  console.error(report.failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Deployment verified at ${report.target} (${report.release.version}, ${report.release.revision.slice(0, 12)}, ${Math.round(report.startupBytes / 1024)} KiB startup transfer).`
  );
}

function check(condition, success, failure) {
  report.checks.push({ name: success, passed: Boolean(condition) });
  if (!condition) report.failures.push(failure);
}

async function request(path) {
  const startedAt = performance.now();
  const response = await fetchWithRetry(new URL(path, baseUrl));
  return {
    response,
    body: await response.text(),
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await globalThis.fetch(url, {
        cache: 'no-store',
        headers: { 'user-agent': 'Pixavelo-Operations/1.0' },
        signal: globalThis.AbortSignal.timeout(15_000)
      });
      if (response.status >= 500 && attempt < attempts) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(2000);
    }
  }
  throw lastError;
}

function gitRevision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function revisionsMatch(actual, expected) {
  const left = String(actual).toLowerCase();
  const right = String(expected).toLowerCase();
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function parseArguments(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--base-url') parsed.baseUrl = args[++index];
    else if (value === '--expected-revision') parsed.expectedRevision = args[++index];
    else if (value === '--report') parsed.report = args[++index];
    else throw new Error(`Unknown deployment verification argument: ${value}`);
  }
  return parsed;
}
