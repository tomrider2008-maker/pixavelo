import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

const command = process.argv[2];
const options = parseArguments(process.argv.slice(3));
const platforms = new Set(['windows', 'macos', 'ios-safari', 'android-chrome']);
const requiredChecks = new Set([
  'dashboard-and-layout',
  'pwa-install-and-offline',
  'conversion-and-download',
  'feature-regression',
  'privacy-boundary',
  'upgrade-lifecycle',
  'stress-and-resource-pressure'
]);

if (command === 'init') {
  if (!platforms.has(options.platform)) throw new Error('init requires a supported --platform.');
  if (!options.output) throw new Error('init requires --output.');
  const templateUrl = new URL('../docs/device-certification.template.json', import.meta.url);
  const template = JSON.parse(await readFile(templateUrl, 'utf8'));
  template.platform = options.platform;
  template.createdAt = new Date().toISOString();
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(template, null, 2)}\n`);
  console.log(`Created pending ${options.platform} certification record at ${options.output}.`);
} else if (command === 'validate') {
  if (!options.file) throw new Error('validate requires --file.');
  const result = await validateRecord(options.file);
  console.log(`${options.file}: valid ${result.status} physical-device record.`);
} else if (command === 'report') {
  if (!options.input) throw new Error('report requires --input.');
  const records = [];
  for (const path of await jsonFiles(options.input)) {
    try {
      records.push({ path, ...(await validateRecord(path)) });
    } catch (error) {
      records.push({ path, status: 'invalid', error: message(error) });
    }
  }
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    platformCoverage: Object.fromEntries(
      [...platforms].map((platform) => [platform, platformCoverage(platform, records)])
    ),
    requiredPlatforms: [...platforms],
    records
  };
  summary.certifiedPlatforms = [...platforms].filter(
    (platform) => summary.platformCoverage[platform].complete
  );
  summary.complete = summary.certifiedPlatforms.length === platforms.size;
  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.log(
    `Device certification: ${summary.certifiedPlatforms.length}/${summary.requiredPlatforms.length} platforms passed; complete=${summary.complete}.`
  );
} else if (command === 'hash') {
  if (!options.file) throw new Error('hash requires --file.');
  console.log(await fileSha256(options.file));
} else if (command === 'copy-template') {
  if (!options.output) throw new Error('copy-template requires --output.');
  await mkdir(dirname(options.output), { recursive: true });
  await copyFile(
    new URL('../docs/device-certification.template.json', import.meta.url),
    options.output
  );
  console.log(`Copied the pending certification template to ${options.output}.`);
} else {
  throw new Error('Usage: device-certification.mjs init|validate|report|hash [options]');
}

async function validateRecord(path) {
  const record = JSON.parse(await readFile(path, 'utf8'));
  if (record.schemaVersion !== 1) throw new Error('Unsupported device evidence schema.');
  if (!platforms.has(record.platform)) throw new Error('Unsupported platform.');
  if (!['pending', 'passed', 'failed'].includes(record.status)) throw new Error('Invalid status.');
  const checks = Array.isArray(record.checks) ? record.checks : [];
  const ids = new Set(checks.map((check) => check.id));
  for (const id of requiredChecks) if (!ids.has(id)) throw new Error(`Missing check: ${id}`);
  if (record.status === 'pending') return { platform: record.platform, status: record.status };

  for (const value of [
    record.device?.model,
    record.device?.formFactor,
    record.device?.memoryClass,
    record.device?.displayClass,
    record.device?.osVersion,
    record.device?.browser,
    record.device?.browserVersion,
    record.tester?.name,
    record.tester?.date
  ]) {
    if (!String(value ?? '').trim())
      throw new Error('Completed records require device and tester metadata.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(record.release?.version ?? '')) {
    throw new Error('Completed records require a semantic release version.');
  }
  if (!/^[a-f0-9]{40}$/.test(record.release?.revision ?? '')) {
    throw new Error('Completed records require a full release revision.');
  }
  if (!String(record.release?.url ?? '').startsWith('https://')) {
    throw new Error('Completed records require an HTTPS release URL.');
  }
  if (!Array.isArray(record.device?.viewports) || record.device.viewports.length === 0) {
    throw new Error('Completed records require tested viewport evidence.');
  }
  assertPlatformBrowser(record.platform, record.device.browser);
  if (
    ['ios-safari', 'android-chrome'].includes(record.platform) &&
    !['portrait', 'landscape'].every((value) => record.device?.orientations?.includes(value))
  ) {
    throw new Error('Completed mobile records require portrait and landscape evidence.');
  }
  if (record.status === 'passed' && checks.some((check) => check.result !== 'passed')) {
    throw new Error('A passed certification requires every physical check to pass.');
  }
  if (record.status === 'failed' && !checks.some((check) => check.result === 'failed')) {
    throw new Error('A failed certification must identify at least one failed check.');
  }
  for (const check of checks) {
    if (!['passed', 'failed'].includes(check.result)) {
      throw new Error(`Completed record has no result for ${check.id}.`);
    }
    if (!Array.isArray(check.evidence) || check.evidence.length === 0) {
      throw new Error(`Completed record has no evidence references for ${check.id}.`);
    }
  }

  const evidence = Array.isArray(record.evidence) ? record.evidence : [];
  const evidenceIds = new Set(evidence.map((item) => item.id));
  for (const check of checks) {
    for (const id of check.evidence) {
      if (!evidenceIds.has(id)) throw new Error(`Unknown evidence reference ${id} in ${check.id}.`);
    }
  }
  for (const kind of ['dashboard', 'processing-result', 'offline']) {
    if (!evidence.some((item) => item.kind === kind)) {
      throw new Error(`Completed record requires ${kind} evidence.`);
    }
  }
  const root = resolve(dirname(path));
  for (const item of evidence) {
    if (!item.id || !item.kind || !item.path || !/^[a-f0-9]{64}$/.test(item.sha256 ?? '')) {
      throw new Error('Every evidence item requires id, kind, path and SHA-256.');
    }
    if (isAbsolute(item.path)) throw new Error(`Evidence path must be relative: ${item.path}`);
    const evidencePath = resolve(root, item.path);
    if (evidencePath !== root && !evidencePath.startsWith(`${root}${sep}`)) {
      throw new Error(`Evidence path leaves the certification package: ${item.path}`);
    }
    if ((await fileSha256(evidencePath)) !== item.sha256) {
      throw new Error(`Evidence digest mismatch: ${item.path}`);
    }
  }
  return {
    platform: record.platform,
    status: record.status,
    release: record.release,
    device: record.device
  };
}

function platformCoverage(platform, records) {
  const passed = records.filter(
    (record) => record.platform === platform && record.status === 'passed'
  );
  const browsers = new Set(passed.map((record) => normalizeBrowser(record.device?.browser)));
  if (platform === 'windows') {
    const requiredBrowsers = ['edge', 'chrome', 'firefox'];
    const complete =
      requiredBrowsers.every((browser) => browsers.has(browser)) &&
      passed.some((record) => /laptop/i.test(record.device?.formFactor ?? '')) &&
      passed.some((record) =>
        record.device?.viewports?.some((viewport) => /1920\s*[x×]\s*1080|1080p/i.test(viewport))
      );
    return { complete, requiredBrowsers, observedBrowsers: [...browsers] };
  }
  if (platform === 'macos') {
    const requiredBrowsers = ['safari', 'chrome', 'firefox'];
    const complete =
      requiredBrowsers.every((browser) => browsers.has(browser)) &&
      passed.some(
        (record) =>
          /laptop/i.test(record.device?.formFactor ?? '') &&
          /retina/i.test(record.device?.displayClass ?? '')
      );
    return { complete, requiredBrowsers, observedBrowsers: [...browsers] };
  }
  if (platform === 'ios-safari') {
    const majors = [
      ...new Set(
        passed
          .map((record) => Number.parseInt(record.device?.osVersion, 10))
          .filter(Number.isInteger)
      )
    ].sort((left, right) => left - right);
    const adjacentMajors = majors.length >= 2 && majors.at(-1) - majors.at(-2) === 1;
    return { complete: adjacentMajors && browsers.has('safari'), observedMajorVersions: majors };
  }
  const formFactors = new Set(
    passed.map((record) => String(record.device?.formFactor ?? '').toLowerCase())
  );
  return {
    complete:
      browsers.has('chrome') &&
      [...formFactors].some((value) => value.includes('phone')) &&
      [...formFactors].some((value) => value.includes('tablet')),
    observedFormFactors: [...formFactors]
  };
}

function assertPlatformBrowser(platform, browser) {
  const normalized = normalizeBrowser(browser);
  const permitted = {
    windows: ['edge', 'chrome', 'firefox'],
    macos: ['safari', 'chrome', 'firefox'],
    'ios-safari': ['safari'],
    'android-chrome': ['chrome']
  }[platform];
  if (!permitted.includes(normalized)) {
    throw new Error(`${platform} evidence cannot certify browser ${browser}.`);
  }
}

function normalizeBrowser(browser) {
  const value = String(browser ?? '').toLowerCase();
  if (value.includes('edge')) return 'edge';
  if (value.includes('chrome')) return 'chrome';
  if (value.includes('firefox')) return 'firefox';
  if (value.includes('safari')) return 'safari';
  return value;
}

async function jsonFiles(path) {
  const metadata = await stat(path);
  if (metadata.isFile()) return [path];
  const output = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) output.push(...(await jsonFiles(child)));
    else if (entry.name.endsWith('.json')) output.push(child);
  }
  return output;
}

async function fileSha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArguments(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--platform') parsed.platform = args[++index];
    else if (value === '--output') parsed.output = args[++index];
    else if (value === '--file') parsed.file = args[++index];
    else if (value === '--input') parsed.input = args[++index];
    else throw new Error(`Unknown device certification argument: ${value}`);
  }
  return parsed;
}
