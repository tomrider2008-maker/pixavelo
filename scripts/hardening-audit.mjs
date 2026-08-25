import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];

const sourceFiles = (await walk(join(root, 'src'))).filter(
  (file) => /\.(?:ts|tsx)$/.test(file) && !/\.(?:test|spec)\./.test(file)
);
const source = await Promise.all(
  sourceFiles.map(async (file) => [relative(root, file), await readFile(file, 'utf8')])
);

const forbidden = [
  [
    /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML|document\.write\s*\(/,
    'unsafe DOM HTML sink'
  ],
  [/\beval\s*\(|new\s+Function\s*\(/, 'dynamic code execution'],
  [
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\.sendBeacon\s*\(/,
    'runtime network client'
  ]
];
for (const [file, text] of source) {
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) failures.push(`${file}: ${label}`);
  }
}

const headers = await readFile(join(root, 'public', '_headers'), 'utf8');
for (const directive of [
  "default-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Embedder-Policy: require-corp',
  'Permissions-Policy:'
]) {
  if (!headers.includes(directive)) failures.push(`public/_headers: missing ${directive}`);
}

const config = await readFile(join(root, 'vite.config.ts'), 'utf8');
for (const codecPattern of ['avif_enc', 'encode-', 'heic-', 'tiffCodec-']) {
  if (!config.includes(codecPattern))
    failures.push(`vite.config.ts: codec ${codecPattern} is not excluded from precache`);
}

const dist = join(root, 'dist');
if (await exists(dist)) {
  const buildFiles = await walk(dist);
  if (buildFiles.some((file) => file.endsWith('.map')))
    failures.push('dist: production source map found');
  for (const required of ['index.html', 'manifest.webmanifest', 'sw.js', '_headers']) {
    if (!(await exists(join(dist, required)))) failures.push(`dist: missing ${required}`);
  }
}

if (failures.length > 0) {
  console.error(`Hardening audit failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(
    `Hardening audit passed (${sourceFiles.length} runtime source files, CSP/network/DOM/PWA/build controls verified).`
  );
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else output.push(path);
  }
  return output;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
