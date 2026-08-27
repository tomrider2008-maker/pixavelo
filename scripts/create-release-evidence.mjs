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
const [deviceReport, sloReport] = await Promise.all([
  optionalJson(
    process.env.PIXAVELO_DEVICE_CERTIFICATION_REPORT ??
      new URL('../.artifacts/operations/device-certification.json', import.meta.url)
  ),
  optionalJson(
    process.env.PIXAVELO_SLO_REPORT ??
      new URL('../.artifacts/operations/slo-report.json', import.meta.url)
  )
]);
const policyAdvisories = releasePolicyAdvisories(deviceReport, sloReport);
for (const warning of policyAdvisories.warnings) console.warn(`WARNING: ${warning}`);
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
  policyAdvisories,
  files
};

await mkdir(output, { recursive: true });
await writeFile(new URL('sbom.cdx.json', output), `${JSON.stringify(sbom, null, 2)}\n`);
await writeFile(new URL('release-evidence.json', output), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(
  `Release evidence created for ${release.version} (${files.length} files, digest ${deploymentDigest.slice(0, 12)}).`
);

function releasePolicyAdvisories(deviceResult, sloResult) {
  const requiredPlatforms = ['windows', 'macos', 'ios-safari', 'android-chrome'];
  const device = deviceResult.value;
  const slo = sloResult.value;
  const uncertifiedPlatforms = Array.isArray(device?.uncertifiedPlatforms)
    ? device.uncertifiedPlatforms
    : requiredPlatforms.filter((platform) => !device?.platformCoverage?.[platform]?.complete);
  const deviceStatus = deviceResult.error
    ? 'invalid'
    : device?.complete === true
      ? 'complete'
      : device
        ? 'incomplete'
        : 'not_provided';
  const sloStatus = sloResult.error
    ? 'invalid'
    : slo?.window?.claimable30DayWindow === true
      ? slo?.objectivesMet === true
        ? 'complete'
        : 'objectives_not_met'
      : slo
        ? 'incomplete'
        : 'not_provided';
  const warnings = [];
  if (deviceStatus !== 'complete') {
    warnings.push(
      `Physical-device QA is ${deviceStatus}; uncertified platforms: ${uncertifiedPlatforms.join(', ') || 'not reported'}. This advisory is retained without blocking release.`
    );
  }
  if (sloStatus !== 'complete') {
    warnings.push(
      `The 30-day SLO record is ${sloStatus}. Monitoring and evidence integrity remain active, but historical-window completeness is advisory for release.`
    );
  }
  return {
    schemaVersion: 1,
    blocking: false,
    policy: 'solo-maintainer-2026-08-27',
    independentReview: {
      blocking: false,
      required: false,
      status: 'owner-authorized-solo-maintainer-policy'
    },
    physicalDeviceQa: {
      blocking: false,
      status: deviceStatus,
      certifiedPlatforms: Array.isArray(device?.certifiedPlatforms)
        ? device.certifiedPlatforms
        : [],
      uncertifiedPlatforms,
      source: deviceResult.source,
      ...(deviceResult.error ? { error: deviceResult.error } : {})
    },
    slo30DayWindow: {
      blocking: false,
      status: sloStatus,
      claimable: slo?.window?.claimable30DayWindow === true,
      objectivesMet: slo?.objectivesMet === true,
      source: sloResult.source,
      ...(sloResult.error ? { error: sloResult.error } : {})
    },
    warnings
  };
}

async function optionalJson(path) {
  const source = path instanceof URL ? path.pathname : String(path);
  try {
    return { source, value: JSON.parse(await readFile(path, 'utf8')), error: null };
  } catch (error) {
    if (error?.code === 'ENOENT') return { source, value: null, error: null };
    return {
      source,
      value: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

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
