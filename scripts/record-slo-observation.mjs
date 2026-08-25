import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const options = parseArguments(process.argv.slice(2));
if (!['endpoint', 'browser'].includes(options.kind)) {
  throw new Error('--kind must be endpoint or browser.');
}

const observation =
  options.kind === 'endpoint'
    ? await endpointObservation(options)
    : await browserObservation(options);
const unsigned = { schemaVersion: 1, ...observation };
const evidenceHash = sha256(JSON.stringify(unsigned));
const output = { ...unsigned, evidenceHash };
const outputPath =
  options.output ??
  `.artifacts/operations/slo-observation-${options.kind}-${output.observationId}.json`;
await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Recorded ${options.kind} SLO observation ${output.observationId} (${summarizeStatuses(output.objectives)}).`
);

async function endpointObservation(input) {
  if (!input.report) throw new Error('Endpoint observations require --report.');
  const sourceText = await readFile(input.report, 'utf8');
  const report = JSON.parse(sourceText);
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const allChecksPassed = checks.length > 0 && checks.every((check) => check.passed === true);
  const executionPassed = !input.status || ['success', 'passed'].includes(input.status);
  const availability = allChecksPassed && report.failures?.length === 0 && executionPassed;
  const routeMeasurements = Array.isArray(report.routeMeasurements) ? report.routeMeasurements : [];
  const legacyLatencyChecks = checks.filter((check) =>
    check.name?.includes('responds within 5 seconds')
  );
  const latencyObserved = routeMeasurements.length > 0 || legacyLatencyChecks.length > 0;
  const latencyPassed =
    routeMeasurements.length > 0
      ? routeMeasurements.every((route) => route.durationMs < 5000)
      : legacyLatencyChecks.length === 5 && legacyLatencyChecks.every((check) => check.passed);
  const release = report.release;
  const releaseObserved = Boolean(release);
  const releaseIntegrity =
    releaseObserved &&
    release.schemaVersion === 1 &&
    release.dirty === false &&
    /^[a-f0-9]{40}$/.test(String(release.revision ?? '')) &&
    /^\d+\.\d+\.\d+$/.test(String(release.version ?? '')) &&
    checks
      .filter((check) => /release|revision|startup transfer/.test(String(check.name)))
      .every((check) => check.passed === true);
  const observedAt = report.checkedAt ?? new Date().toISOString();
  const sourceDigest = sha256(sourceText);
  const identity = sha256(
    ['endpoint', observedAt, report.target, release?.revision, sourceDigest].join('|')
  ).slice(0, 24);
  return {
    observationId: identity,
    kind: 'endpoint',
    observedAt,
    target: report.target ?? null,
    source: sourceMetadata(input, sourceDigest, input.report),
    release: release
      ? {
          version: release.version ?? null,
          revision: release.revision ?? null,
          dirty: release.dirty
        }
      : null,
    objectives: {
      availability: availability ? 'passed' : 'failed',
      privacy: 'not_observed',
      releaseIntegrity: releaseObserved ? (releaseIntegrity ? 'passed' : 'failed') : 'not_observed',
      latency: latencyObserved ? (latencyPassed ? 'passed' : 'failed') : 'not_observed'
    },
    measurements: {
      checksPassed: checks.filter((check) => check.passed === true).length,
      checksFailed: checks.filter((check) => check.passed !== true).length,
      startupBytes: report.startupBytes ?? null,
      routeDurationsMs: routeMeasurements.map(({ path, durationMs }) => ({ path, durationMs })),
      maximumRouteDurationMs:
        routeMeasurements.length > 0
          ? Math.max(...routeMeasurements.map((route) => route.durationMs))
          : null
    }
  };
}

async function browserObservation(input) {
  if (!input.project) throw new Error('Browser observations require --project.');
  const normalizedStatus = normalizeStatus(input.status);
  const privacyObserved = input.privacyObserved === 'true';
  let sourceDigest = null;
  let stats = null;
  if (input.report) {
    try {
      const sourceText = await readFile(input.report, 'utf8');
      sourceDigest = sha256(sourceText);
      stats = JSON.parse(sourceText).stats ?? null;
    } catch {
      // Installation or runner failures can happen before Playwright writes its JSON report.
    }
  }
  const evidencedStatus =
    normalizedStatus === 'passed' && !sourceDigest ? 'not_observed' : normalizedStatus;
  const observedAt = input.observedAt ?? new Date().toISOString();
  const identity = sha256(
    ['browser', observedAt, input.target, input.project, input.runUrl, sourceDigest].join('|')
  ).slice(0, 24);
  return {
    observationId: identity,
    kind: 'browser',
    observedAt,
    target: input.target ?? 'https://pixavelo.pages.dev',
    source: sourceMetadata(input, sourceDigest, input.report ?? null),
    release: input.revision ? { version: null, revision: input.revision, dirty: null } : null,
    browserProject: input.project,
    objectives: {
      availability: 'not_observed',
      privacy: privacyObserved ? evidencedStatus : 'not_observed',
      releaseIntegrity: 'not_observed',
      latency: 'not_observed',
      browserCompatibility: evidencedStatus
    },
    measurements: { playwrightStats: stats, sourceReportAvailable: Boolean(sourceDigest) }
  };
}

function sourceMetadata(input, digest, path) {
  return {
    type: input.source ?? (process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local'),
    runUrl: input.runUrl ?? null,
    reportPath: path,
    reportSha256: digest
  };
}

function normalizeStatus(status) {
  if (['success', 'passed'].includes(status)) return 'passed';
  if (['failure', 'failed', 'cancelled', 'timed_out'].includes(status)) return 'failed';
  if (status === 'skipped') return 'not_observed';
  throw new Error(`Unsupported browser observation status: ${status ?? 'missing'}`);
}

function summarizeStatuses(objectives) {
  return Object.entries(objectives)
    .map(([name, status]) => `${name}=${status}`)
    .join(', ');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseArguments(args) {
  const parsed = {};
  const valueArguments = new Set([
    '--kind',
    '--report',
    '--output',
    '--status',
    '--project',
    '--target',
    '--revision',
    '--privacy-observed',
    '--observed-at',
    '--run-url',
    '--source'
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (!valueArguments.has(name)) throw new Error(`Unknown SLO observation argument: ${name}`);
    parsed[toCamelCase(name.slice(2))] = args[++index];
  }
  return parsed;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}
