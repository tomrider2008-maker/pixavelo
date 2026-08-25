import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const packageManifest = JSON.parse(await read('package.json'));

for (const script of [
  'release:check',
  'release:artifacts',
  'release:clean',
  'verify:deployment',
  'rollback:pages',
  'rollback:rehearse',
  'observe:slo',
  'report:slo',
  'certify:device',
  'deploy:pages'
]) {
  if (!packageManifest.scripts?.[script]) failures.push(`package.json: missing ${script}`);
}
if (packageManifest.scripts?.['deploy:pages']?.includes('--commit-dirty=true')) {
  failures.push('package.json: deployment still permits a dirty working tree');
}
if (!packageManifest.scripts?.['deploy:pages']?.includes('--commit-dirty=false')) {
  failures.push('package.json: deployment does not explicitly reject dirty releases');
}

const workflowDirectory = join(root, '.github', 'workflows');
const workflowFiles = (await readdir(workflowDirectory)).filter((file) => /\.ya?ml$/.test(file));
for (const required of ['ci.yml', 'production-smoke.yml', 'release.yml', 'rollback.yml']) {
  if (!workflowFiles.includes(required)) failures.push(`.github/workflows: missing ${required}`);
}
for (const file of workflowFiles) {
  const source = await read(join('.github', 'workflows', file));
  for (const match of source.matchAll(/^\s*-?\s*uses:\s+[^@\s]+@([^\s#]+)/gm)) {
    if (!/^[a-f0-9]{40}$/.test(match[1])) {
      failures.push(
        `${file}: GitHub Action is not pinned to a full commit SHA (${match[0].trim()})`
      );
    }
  }
}

const productionSmoke = await read('.github/workflows/production-smoke.yml');
if (!productionSmoke.includes("cron: '17 * * * *'")) {
  failures.push('production-smoke.yml: hourly availability probe is missing');
}
if (!productionSmoke.includes("cron: '15 3 * * *'")) {
  failures.push('production-smoke.yml: daily browser matrix is missing');
}
if (!productionSmoke.includes('verify:deployment')) {
  failures.push('production-smoke.yml: deployment verifier is not executed');
}
if (!productionSmoke.includes('observe:slo')) {
  failures.push('production-smoke.yml: SLO observations are not retained');
}
if (!productionSmoke.includes('failure-escalation')) {
  failures.push('production-smoke.yml: failure escalation is missing');
}
if (!productionSmoke.includes('retention-days: 90')) {
  failures.push('production-smoke.yml: 90-day evidence retention is missing');
}

const dependabot = await read('.github/dependabot.yml');
for (const ecosystem of ['npm', 'github-actions']) {
  if (!dependabot.includes(`package-ecosystem: '${ecosystem}'`)) {
    failures.push(`dependabot.yml: ${ecosystem} maintenance is missing`);
  }
}

const viteConfig = await read('vite.config.ts');
for (const control of [
  "registerType: 'prompt'",
  'cleanupOutdatedCaches: true',
  'clientsClaim: true',
  'skipWaiting: false'
]) {
  if (!viteConfig.includes(control))
    failures.push(`vite.config.ts: missing PWA control ${control}`);
}
if (viteConfig.includes('skipWaiting: true')) {
  failures.push(
    'vite.config.ts: service-worker activation can still bypass the safe update prompt'
  );
}
const updateLifecycle = await read('src/components/feedback/ServiceWorkerUpdate.tsx');
for (const control of ['New version available', 'hasProcessingActivity', 'SKIP_WAITING']) {
  if (!updateLifecycle.includes(control)) {
    failures.push(`ServiceWorkerUpdate.tsx: missing lifecycle control ${control}`);
  }
}
const headers = await read('public/_headers');
if (!headers.includes('/release.json') || !headers.includes('no-store')) {
  failures.push('public/_headers: release provenance is not protected from stale caching');
}

for (const [file, headings] of [
  ['docs/SLO.md', ['Availability SLO', 'Privacy SLO', 'Error budget']],
  [
    'docs/OPERATIONS.md',
    ['Release procedure', 'Rollback procedure', 'Incident response', 'Service-worker recovery']
  ],
  ['docs/PHYSICAL_DEVICE_QA.md', ['Release sign-off', 'iOS Safari', 'Android Chrome']],
  ['docs/PHASE_12_OPERATIONS.md', ['Phase 12', 'Acceptance status']],
  [
    'docs/PHASE_13_CERTIFICATION.md',
    ['Phase 13', 'Go/no-go decision', 'External activation gates']
  ],
  [
    'docs/GITHUB_OPERATIONS_ACTIVATION.md',
    ['Protected production environment', 'Secret inventory', 'Activation verification']
  ]
]) {
  const source = await read(file);
  for (const heading of headings) {
    if (!source.includes(heading)) failures.push(`${file}: missing ${heading}`);
  }
}

if (failures.length > 0) {
  console.error(
    `Operational audit failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`
  );
  process.exitCode = 1;
} else {
  console.log(
    `Operational audit passed (${workflowFiles.length} pinned workflows, release/rollback/PWA/SLO/maintenance controls verified).`
  );
}

async function read(path) {
  try {
    return await readFile(join(root, path), 'utf8');
  } catch {
    failures.push(`${path}: required operational artifact is missing`);
    return '';
  }
}
