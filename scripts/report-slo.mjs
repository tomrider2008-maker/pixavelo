import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1000;
const options = parseArguments(process.argv.slice(2));
const asOf = new Date(options.asOf ?? Date.now());
if (Number.isNaN(asOf.getTime())) throw new Error('--as-of must be an ISO date.');
const days = Number(options.days ?? 30);
if (!Number.isInteger(days) || days < 1) throw new Error('--days must be a positive integer.');
const inputs = options.inputs.length > 0 ? options.inputs : ['.artifacts/operations'];
const inputFiles = [];
for (const input of inputs) inputFiles.push(...(await jsonFiles(input)));
const paths = inputFiles.filter((path) => /slo-observation.*\.json$/i.test(basename(path)));

const observationsById = new Map();
for (const path of paths) {
  const observation = JSON.parse(await readFile(path, 'utf8'));
  if (observation.schemaVersion !== 1 || !['endpoint', 'browser'].includes(observation.kind)) {
    continue;
  }
  if (Number.isNaN(Date.parse(observation.observedAt))) {
    throw new Error(`Observation timestamp is invalid: ${path}`);
  }
  const { evidenceHash, ...unsigned } = observation;
  if (sha256(JSON.stringify(unsigned)) !== evidenceHash) {
    throw new Error(`Observation evidence hash is invalid: ${path}`);
  }
  const existing = observationsById.get(observation.observationId);
  if (existing && existing.evidenceHash !== evidenceHash) {
    throw new Error(`Observation ID collision: ${observation.observationId}`);
  }
  observation.sourceVerified = await sourceVerified(observation, inputFiles);
  observationsById.set(observation.observationId, observation);
}

const windowStart = new Date(asOf.getTime() - days * DAY_MS);
const observations = [...observationsById.values()]
  .filter((entry) => {
    const time = Date.parse(entry.observedAt);
    return time >= windowStart.getTime() && time <= asOf.getTime();
  })
  .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
const endpoints = observations.filter((entry) => entry.kind === 'endpoint' && entry.sourceVerified);
const privacy = observations.filter(
  (entry) =>
    entry.kind === 'browser' &&
    entry.objectives.privacy !== 'not_observed' &&
    (entry.sourceVerified || entry.objectives.privacy === 'failed')
);
const availabilityCoverage = coverage(endpoints, windowStart, asOf, 90);
const privacyCoverage = coverage(privacy, windowStart, asOf, 36 * 60);
const availabilityPassed = endpoints.filter(
  (entry) => entry.objectives.availability === 'passed'
).length;
const availabilityFailed = endpoints.filter(
  (entry) => entry.objectives.availability === 'failed'
).length;
const availabilitySamples = availabilityPassed + availabilityFailed;
const privacyFailed = privacy.filter((entry) => entry.objectives.privacy === 'failed').length;
const releaseIntegrityFailed = endpoints.filter(
  (entry) => entry.objectives.releaseIntegrity === 'failed'
).length;
const latencyFailed = endpoints.filter((entry) => entry.objectives.latency === 'failed').length;
const availabilityRate = availabilitySamples > 0 ? availabilityPassed / availabilitySamples : null;
const revisions = [...new Set(endpoints.map((entry) => entry.release?.revision).filter(Boolean))];
const maximumRouteDurationMs = maximum(
  endpoints.map((entry) => entry.measurements?.maximumRouteDurationMs).filter(Number.isFinite)
);
const claimable30DayWindow = availabilityCoverage.complete && privacyCoverage.complete;
const objectivesMet =
  claimable30DayWindow &&
  availabilityRate !== null &&
  availabilityRate >= 0.999 &&
  privacyFailed === 0 &&
  releaseIntegrityFailed === 0 &&
  latencyFailed === 0;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  window: {
    days,
    from: windowStart.toISOString(),
    through: asOf.toISOString(),
    claimable30DayWindow,
    reason: claimable30DayWindow
      ? null
      : 'The ledger does not yet contain continuous hourly endpoint and daily privacy evidence for the full window.'
  },
  evidence: {
    observations: observations.length,
    endpoint: endpoints.length,
    privacy: privacy.length,
    unverifiedSources: observations.filter((entry) => !entry.sourceVerified).length
  },
  availability: {
    objective: 0.999,
    passed: availabilityPassed,
    failed: availabilityFailed,
    successRate: availabilityRate,
    conservativeUnavailableHours: availabilityFailed,
    coverage: availabilityCoverage
  },
  privacy: { objective: 1, failed: privacyFailed, coverage: privacyCoverage },
  releaseIntegrity: { failed: releaseIntegrityFailed, revisions },
  latency: { failed: latencyFailed, maximumRouteDurationMs, guardrailMs: 5000 },
  objectivesMet
};
const jsonPath = options.outputJson ?? '.artifacts/operations/slo-report.json';
const markdownPath = options.outputMarkdown ?? '.artifacts/operations/slo-report.md';
await Promise.all([
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`),
  write(markdownPath, markdown(report))
]);
console.log(
  `SLO report: ${observations.length} observations, ${claimable30DayWindow ? 'complete' : 'incomplete'} ${days}-day window, objectives ${objectivesMet ? 'met' : 'not claimable/met'}.`
);

function coverage(entries, start, end, maximumGapMinutes) {
  if (entries.length === 0) return { complete: false, maximumGapMinutes: null };
  const times = entries.map((entry) => Date.parse(entry.observedAt)).sort((a, b) => a - b);
  const gaps = [times[0] - start.getTime(), end.getTime() - times.at(-1)];
  for (let index = 1; index < times.length; index += 1) gaps.push(times[index] - times[index - 1]);
  const largest = Math.max(...gaps) / 60_000;
  return {
    complete: largest <= maximumGapMinutes,
    maximumGapMinutes: Math.round(largest * 10) / 10
  };
}

function maximum(values) {
  return values.length > 0 ? Math.max(...values) : null;
}

function markdown(value) {
  const rate = value.availability.successRate;
  return `# Pixavelo SLO observation report

- Window: ${value.window.from} through ${value.window.through}
- Claimable ${value.window.days}-day record: ${value.window.claimable30DayWindow ? 'yes' : 'no'}
- Endpoint observations: ${value.evidence.endpoint}
- Privacy browser observations: ${value.evidence.privacy}
- Availability: ${rate === null ? 'not observed' : `${(rate * 100).toFixed(3)}%`}
- Conservative unavailable time: ${value.availability.conservativeUnavailableHours} hour(s)
- Privacy failures: ${value.privacy.failed}
- Release-integrity failures: ${value.releaseIntegrity.failed}
- Latency failures: ${value.latency.failed}
- Deployment revisions: ${value.releaseIntegrity.revisions.join(', ') || 'not observed'}
- Objectives met: ${value.objectivesMet ? 'yes' : 'not yet claimable/met'}

${value.window.reason ?? 'The full observation window is present.'}
`;
}

async function jsonFiles(path) {
  try {
    const metadata = await stat(path);
    if (metadata.isFile()) return [path];
    const output = [];
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) output.push(...(await jsonFiles(child)));
      else if (entry.name.endsWith('.json')) output.push(child);
    }
    return output;
  } catch {
    return [];
  }
}

async function sourceVerified(observation, files) {
  const expected = observation.source?.reportSha256;
  const reportPath = observation.source?.reportPath;
  if (!expected || !reportPath) return false;
  const reportName = basename(reportPath);
  for (const path of files) {
    if (path === reportPath || basename(path) === reportName) {
      if (sha256(await readFile(path)) === expected) return true;
    }
  }
  return false;
}

async function write(path, contents) {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, contents);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseArguments(args) {
  const parsed = { inputs: [] };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--input') parsed.inputs.push(args[++index]);
    else if (value === '--days') parsed.days = args[++index];
    else if (value === '--as-of') parsed.asOf = args[++index];
    else if (value === '--output-json') parsed.outputJson = args[++index];
    else if (value === '--output-markdown') parsed.outputMarkdown = args[++index];
    else throw new Error(`Unknown SLO reporting argument: ${value}`);
  }
  return parsed;
}
