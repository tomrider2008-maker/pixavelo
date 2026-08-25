import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import {
  assertRollbackTarget,
  assertTargetRelease,
  immutableDeploymentUrl,
  revisionsMatch,
  validateRollbackOptions
} from './lib/rollback-contract.mjs';

const options = validateRollbackOptions(parseArguments(process.argv.slice(2)));
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const projectName = options.project;

if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is missing or invalid.');
}
if (!apiToken)
  throw new Error('CLOUDFLARE_API_TOKEN is required and must have Pages Write access.');

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments/${options.deployment}`;
const targetPayload = await cloudflare(endpoint);
const target = targetPayload.result;
assertRollbackTarget(target, options.deployment);
const targetUrl = immutableDeploymentUrl(target, projectName);
const targetReleaseResponse = await globalThis.fetch(new URL('/release.json', targetUrl), {
  cache: 'no-store',
  signal: globalThis.AbortSignal.timeout(15_000)
});
if (!targetReleaseResponse.ok) {
  throw new Error('Rollback refused. Target release provenance is unavailable.');
}
const targetRelease = await targetReleaseResponse.json();
assertTargetRelease(targetRelease, options.expectedRevision);

const rollbackPayload = await cloudflare(`${endpoint}/rollback`, { method: 'POST' });
const result = rollbackPayload.result;
const report = {
  schemaVersion: 1,
  project: projectName,
  targetDeploymentId: options.deployment,
  targetUrl: targetUrl.href.replace(/\/$/, ''),
  expectedRevision: options.expectedRevision,
  targetRelease,
  rolledBackAt: new Date().toISOString(),
  resultDeploymentId: result?.id ?? null,
  aliases: result?.aliases ?? []
};
await mkdir('.artifacts/operations', { recursive: true });
await writeFile(
  `.artifacts/operations/rollback-${options.deployment}.json`,
  `${JSON.stringify(report, null, 2)}\n`
);

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
