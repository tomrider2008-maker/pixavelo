import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';

const root = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const output = new URL('../.artifacts/release/', import.meta.url);
const release = JSON.parse(await readFile(new URL('release.json', dist), 'utf8'));

if (release.dirty !== false) {
  throw new Error('Release evidence can only be generated from a clean build.');
}

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('Run release evidence generation through `npm run release:artifacts`.');
}
const sbomText = execFileSync(
  process.execPath,
  [npmCli, 'sbom', '--sbom-format', 'cyclonedx', '--omit=dev'],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  }
);
const sbom = JSON.parse(sbomText);
if (sbom.bomFormat !== 'CycloneDX' || !Array.isArray(sbom.components)) {
  throw new Error('npm returned an invalid CycloneDX SBOM.');
}

const files = [];
for (const path of await walk(new URL('.', dist))) {
  const bytes = await readFile(path);
  files.push({
    path: relative(dist.pathname, path.pathname).split(sep).join('/'),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex')
  });
}
files.sort((left, right) => left.path.localeCompare(right.path));

const deploymentDigest = createHash('sha256')
  .update(files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(''))
  .digest('hex');
const evidence = {
  schemaVersion: 1,
  application: release.application,
  version: release.version,
  revision: release.revision,
  builtAt: release.builtAt,
  generatedAt: new Date().toISOString(),
  canonicalUrl: 'https://pixavelo.pages.dev',
  deploymentDigest,
  productionDependencyComponents: sbom.components.length,
  gates: [
    'format',
    'lint',
    'typecheck',
    'coverage',
    'build-artifact',
    'hardening',
    'operations',
    'production-dependency-audit',
    'five-project-browser-matrix'
  ],
  files
};

await mkdir(output, { recursive: true });
await writeFile(new URL('sbom.cdx.json', output), `${JSON.stringify(sbom, null, 2)}\n`);
await writeFile(new URL('release-evidence.json', output), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(
  `Release evidence created for ${release.version} (${files.length} files, digest ${deploymentDigest.slice(0, 12)}).`
);

async function walk(directory) {
  const outputFiles = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(
      entry.name,
      directory.href.endsWith('/') ? directory : new URL(`${directory.href}/`)
    );
    if (entry.isDirectory()) outputFiles.push(...(await walk(new URL(`${path.href}/`))));
    else if ((await stat(path)).isFile()) outputFiles.push(path);
  }
  return outputFiles;
}
