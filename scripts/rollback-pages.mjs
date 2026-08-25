import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const options = parseArguments(process.argv.slice(2));
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const projectName = options.project ?? 'pixavelo';

if (options.confirm !== 'ROLLBACK') {
  throw new Error(
    'Rollback refused. Pass --confirm ROLLBACK after reviewing the target deployment.'
  );
}
if (!/^[a-f0-9-]{36}$/i.test(options.deployment ?? '')) {
  throw new Error('Rollback refused. --deployment must be a Cloudflare deployment UUID.');
}
if (!/^[a-z0-9-]+$/.test(projectName)) throw new Error('Rollback refused. Invalid project name.');
if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is missing or invalid.');
}
if (!apiToken)
  throw new Error('CLOUDFLARE_API_TOKEN is required and must have Pages Write access.');
if (options.expectedRevision && !/^[a-f0-9]{7,40}$/i.test(options.expectedRevision)) {
  throw new Error('Rollback refused. --expected-revision must be a Git revision.');
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments/${options.deployment}`;
const targetPayload = await cloudflare(endpoint);
const target = targetPayload.result;
if (!target || String(target.environment).toLowerCase() !== 'production') {
  throw new Error('Rollback refused. The target is not a production deployment.');
}
if (target.latest_stage?.status !== 'success') {
  throw new Error('Rollback refused. The target deployment did not complete successfully.');
}

const rollbackPayload = await cloudflare(`${endpoint}/rollback`, { method: 'POST' });
const result = rollbackPayload.result;
const report = {
  schemaVersion: 1,
  project: projectName,
  targetDeploymentId: options.deployment,
  expectedRevision: options.expectedRevision ?? null,
  rolledBackAt: new Date().toISOString(),
  resultDeploymentId: result?.id ?? null,
  aliases: result?.aliases ?? []
};
await mkdir('.artifacts/operations', { recursive: true });
await writeFile(
  `.artifacts/operations/rollback-${options.deployment}.json`,
  `${JSON.stringify(report, null, 2)}\n`
);

if (options.expectedRevision) {
  const baseUrl = options.baseUrl ?? 'https://pixavelo.pages.dev';
  let verified = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const response = await globalThis.fetch(new URL('/release.json', baseUrl), {
        cache: 'no-store',
        signal: globalThis.AbortSignal.timeout(10_000)
      });
      const release = await response.json();
      if (revisionsMatch(release.revision, options.expectedRevision)) {
        verified = true;
        break;
      }
    } catch {
      // The canonical alias can take a few seconds to converge after rollback.
    }
    await delay(2500);
  }
  if (!verified)
    throw new Error('Rollback completed, but the expected production revision was not observed.');
}

console.log(`Rolled ${projectName} back to deployment ${options.deployment}.`);

async function cloudflare(url, init = {}) {
  const response = await globalThis.fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: globalThis.AbortSignal.timeout(20_000)
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) {
    const message =
      payload.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`;
    throw new Error(`Cloudflare Pages request failed: ${message}`);
  }
  return payload;
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
    if (value === '--deployment') parsed.deployment = args[++index];
    else if (value === '--confirm') parsed.confirm = args[++index];
    else if (value === '--expected-revision') parsed.expectedRevision = args[++index];
    else if (value === '--project') parsed.project = args[++index];
    else if (value === '--base-url') parsed.baseUrl = args[++index];
    else throw new Error(`Unknown rollback argument: ${value}`);
  }
  return parsed;
}
