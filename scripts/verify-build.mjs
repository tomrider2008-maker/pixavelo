import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);
const distPath = fileURLToPath(dist);
const failures = [];

async function requireFile(path) {
  try {
    await stat(new URL(path, dist));
  } catch {
    failures.push(`Missing deployment artifact: dist/${path}`);
  }
}

for (const path of [
  'index.html',
  'manifest.webmanifest',
  'release.json',
  'sw.js',
  '_headers',
  '_redirects'
]) {
  await requireFile(path);
}

const files = await readdir(dist, { recursive: true });
const sourceMaps = files.filter((path) => path.endsWith('.map'));
if (sourceMaps.length > 0)
  failures.push(`Production source maps are present: ${sourceMaps.join(', ')}`);

let javascriptBytes = 0;
let codecJavascriptBytes = 0;
let cssBytes = 0;
const codecJavascriptPattern =
  /^assets[\\/](?:avif[_-]|avifCodec-|avifDecoder-|decode-|encode-|heic-|heifCodec-|heifDecoder-|tiffCodec-|tiffDecoder-).*\.js$/;
for (const path of files) {
  if (!path.endsWith('.js') && !path.endsWith('.css')) continue;
  const size = (await stat(join(distPath, path))).size;
  if (path.endsWith('.js')) {
    javascriptBytes += size;
    if (codecJavascriptPattern.test(path)) codecJavascriptBytes += size;
  }
  if (path.endsWith('.css')) cssBytes += size;
}
const indexHtml = await readFile(new URL('index.html', dist), 'utf8');
const entryScript = /<script[^>]+src="([^"]+\.js)"/.exec(indexHtml)?.[1]?.replace(/^\//, '');
const entryScriptBytes = entryScript ? (await stat(join(distPath, entryScript))).size : 0;
if (!entryScript) failures.push('Production entry script could not be identified.');
if (entryScriptBytes > 340 * 1024)
  failures.push(`Startup JavaScript budget exceeded: ${entryScriptBytes} bytes`);
const applicationJavascriptBytes = javascriptBytes - codecJavascriptBytes;
if (applicationJavascriptBytes > 900 * 1024)
  failures.push(`Application JavaScript budget exceeded: ${applicationJavascriptBytes} bytes`);
if (codecJavascriptBytes > 220 * 1024)
  failures.push(`Lazy codec JavaScript budget exceeded: ${codecJavascriptBytes} bytes`);
if (javascriptBytes > 1100 * 1024)
  failures.push(`Total lazy-inclusive JavaScript ceiling exceeded: ${javascriptBytes} bytes`);
if (cssBytes > 128 * 1024) failures.push(`CSS budget exceeded: ${cssBytes} bytes`);

const heifWasm = files.find((path) => /^assets[\\/]heic_dec-.*\.wasm$/.test(path));
if (!heifWasm) failures.push('Lazy HEIF WebAssembly asset is missing.');
if (heifWasm && (await stat(join(distPath, heifWasm))).size > 1024 * 1024) {
  failures.push('HEIF WebAssembly asset exceeds the 1 MiB budget.');
}
const avifWasm = files.find((path) => /^assets[\\/]avif_dec-.*\.wasm$/.test(path));
if (!avifWasm) failures.push('Lazy AVIF fallback WebAssembly asset is missing.');
if (avifWasm && (await stat(join(distPath, avifWasm))).size > 1200 * 1024) {
  failures.push('AVIF fallback WebAssembly asset exceeds the 1.2 MiB budget.');
}
const avifEncoderWasm = files.filter((path) => /^assets[\\/]avif_enc(?:_mt)?-.*\.wasm$/.test(path));
if (avifEncoderWasm.length === 0) failures.push('Lazy AVIF encoder WebAssembly asset is missing.');
for (const path of avifEncoderWasm) {
  if ((await stat(join(distPath, path))).size > 3600 * 1024) {
    failures.push(`AVIF encoder WebAssembly asset exceeds the 3.6 MiB budget: ${path}`);
  }
}
if (
  indexHtml.includes('avif_dec') ||
  indexHtml.includes('heic_dec') ||
  indexHtml.includes('tiffDecoder')
) {
  failures.push('An advanced codec leaked into the startup document.');
}

const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
for (const header of [
  'Content-Security-Policy:',
  'Strict-Transport-Security:',
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Embedder-Policy: require-corp',
  'Cross-Origin-Resource-Policy: same-origin'
]) {
  if (!headers.includes(header)) failures.push(`Required security control is missing: ${header}`);
}
if (headers.includes('unsafe-eval'))
  failures.push('CSP must not allow unsafe-eval in this release.');

const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8');
if (!redirects.includes('/* /index.html 200')) failures.push('SPA navigation fallback is missing.');

const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));
if (manifest.display !== 'standalone' || manifest.start_url !== '/' || manifest.scope !== '/') {
  failures.push('PWA manifest does not define the expected standalone root scope.');
}
if (!manifest.icons?.some((icon) => icon.purpose === 'maskable')) {
  failures.push('PWA manifest is missing a maskable icon.');
}

const packageManifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
const release = JSON.parse(await readFile(new URL('release.json', dist), 'utf8'));
if (release.schemaVersion !== 1 || release.application !== packageManifest.name) {
  failures.push('Release provenance schema or application identity is invalid.');
}
if (release.version !== packageManifest.version || !/^\d+\.\d+\.\d+$/.test(release.version)) {
  failures.push('Release provenance version does not match package.json stable semver.');
}
if (!/^[a-f0-9]{40}$/.test(release.revision)) {
  failures.push('Release provenance does not contain a full Git revision.');
}
if (Number.isNaN(Date.parse(release.builtAt)) || typeof release.dirty !== 'boolean') {
  failures.push('Release provenance build time or clean-tree state is invalid.');
}
if (process.env.CI && release.dirty) {
  failures.push('CI release artifact was built from a dirty working tree.');
}
if (!headers.includes('/release.json') || !headers.includes('no-store')) {
  failures.push('Release provenance must be served with a no-store cache policy.');
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Release artifact verified (${Math.round(entryScriptBytes / 1024)} KiB startup JS, ${Math.round(applicationJavascriptBytes / 1024)} KiB application JS, ${Math.round(codecJavascriptBytes / 1024)} KiB lazy codec JS, ${Math.round(cssBytes / 1024)} KiB CSS).`
  );
}
