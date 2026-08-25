const options = parseArguments(process.argv.slice(2));
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const runUrl =
  options.runUrl ??
  (repository && process.env.GITHUB_RUN_ID
    ? `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null);
const title = '[Pixavelo] Production operations failure';
const body = [
  'Automated production operations require investigation.',
  '',
  `- Availability probe: ${options.availability ?? 'unknown'}`,
  `- Daily browser matrix: ${options.browser ?? 'not scheduled'}`,
  `- Workflow run: ${runUrl ?? 'unavailable'}`,
  `- Observed at: ${new Date().toISOString()}`,
  '',
  'Treat any privacy failure as SEV-1. Preserve the workflow artifacts and follow docs/OPERATIONS.md.'
].join('\n');

if (options.dryRun) {
  console.log(JSON.stringify({ title, body, productionMutation: false }, null, 2));
  process.exit(0);
}
if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  throw new Error('GITHUB_REPOSITORY is missing or invalid.');
}
if (!token) throw new Error('GITHUB_TOKEN is required to escalate an operational failure.');

const issues = await github(`/repos/${repository}/issues?state=open&per_page=100`);
const existing = issues.find((issue) => !issue.pull_request && issue.title === title);
if (existing) {
  await github(`/repos/${repository}/issues/${existing.number}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body })
  });
  console.log(`Updated operational incident issue #${existing.number}.`);
} else {
  const issue = await github(`/repos/${repository}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body })
  });
  console.log(`Opened operational incident issue #${issue.number}.`);
}

async function github(path, init = {}) {
  const response = await globalThis.fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {})
    },
    signal: globalThis.AbortSignal.timeout(20_000)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`GitHub incident escalation failed with HTTP ${response.status}.`);
  }
  return payload;
}

function parseArguments(args) {
  const parsed = { dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--dry-run') parsed.dryRun = true;
    else if (value === '--availability') parsed.availability = args[++index];
    else if (value === '--browser') parsed.browser = args[++index];
    else if (value === '--run-url') parsed.runUrl = args[++index];
    else throw new Error(`Unknown failure escalation argument: ${value}`);
  }
  return parsed;
}
