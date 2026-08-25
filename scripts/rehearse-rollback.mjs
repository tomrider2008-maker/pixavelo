import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  assertRollbackTarget,
  assertTargetRelease,
  immutableDeploymentUrl,
  validateRollbackOptions
} from './lib/rollback-contract.mjs';

const reportPath =
  parseArguments(process.argv.slice(2)).report ?? '.artifacts/operations/rollback-rehearsal.json';
const deploymentId = '11111111-2222-4333-8444-555555555555';
const revision = '8b235d47744a25ee0254ddd0282db56549366eab';
const target = {
  id: deploymentId,
  environment: 'production',
  url: 'https://af825c06.pixavelo.pages.dev',
  latest_stage: { status: 'success' }
};
const release = { schemaVersion: 1, version: '1.0.0', revision, dirty: false };
const cases = [];

accepts('approved production target', () => {
  const options = validateRollbackOptions({
    deployment: deploymentId,
    expectedRevision: revision,
    confirm: 'ROLLBACK',
    project: 'pixavelo'
  });
  assertRollbackTarget(target, options.deployment);
  immutableDeploymentUrl(target, options.project);
  assertTargetRelease(release, options.expectedRevision);
});
rejects('confirmation typo', () =>
  validateRollbackOptions({
    deployment: deploymentId,
    expectedRevision: revision,
    confirm: 'rollback'
  })
);
rejects('preview target', () =>
  assertRollbackTarget({ ...target, environment: 'preview' }, deploymentId)
);
rejects('failed target', () =>
  assertRollbackTarget({ ...target, latest_stage: { status: 'failure' } }, deploymentId)
);
rejects('foreign deployment URL', () =>
  immutableDeploymentUrl({ ...target, url: 'https://example.com' }, 'pixavelo')
);
rejects('revision mismatch', () =>
  assertTargetRelease(release, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
);

const report = {
  schemaVersion: 1,
  rehearsalAt: new Date().toISOString(),
  mode: 'contract-only',
  productionMutation: false,
  networkRequests: 0,
  cases,
  passed: cases.every((entry) => entry.passed)
};
await mkdir(dirname(resolve(reportPath)), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) {
  console.error('Rollback contract rehearsal failed.');
  process.exitCode = 1;
} else {
  console.log(
    `Rollback contract rehearsal passed (${cases.length} cases, no network or mutation).`
  );
}

function accepts(name, action) {
  try {
    action();
    cases.push({ name, expectation: 'accept', passed: true });
  } catch (error) {
    cases.push({ name, expectation: 'accept', passed: false, error: message(error) });
  }
}

function rejects(name, action) {
  try {
    action();
    cases.push({ name, expectation: 'reject', passed: false, error: 'Unexpected acceptance' });
  } catch (error) {
    cases.push({ name, expectation: 'reject', passed: true, error: message(error) });
  }
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArguments(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--report') parsed.report = args[++index];
    else throw new Error(`Unknown rollback rehearsal argument: ${args[index]}`);
  }
  return parsed;
}
