const deploymentIdPattern = /^[a-f0-9-]{36}$/i;
const projectPattern = /^[a-z0-9-]+$/;
const revisionPattern = /^[a-f0-9]{7,40}$/i;

export function validateRollbackOptions(options) {
  const project = options.project ?? 'pixavelo';
  if (options.confirm !== 'ROLLBACK') {
    throw new Error(
      'Rollback refused. Pass --confirm ROLLBACK after reviewing the target deployment.'
    );
  }
  if (!deploymentIdPattern.test(options.deployment ?? '')) {
    throw new Error('Rollback refused. --deployment must be a Cloudflare deployment UUID.');
  }
  if (!projectPattern.test(project)) throw new Error('Rollback refused. Invalid project name.');
  if (!revisionPattern.test(options.expectedRevision ?? '')) {
    throw new Error('Rollback refused. --expected-revision must be a Git revision.');
  }
  return { ...options, project };
}

export function assertRollbackTarget(target, expectedDeploymentId) {
  if (!target || String(target.environment).toLowerCase() !== 'production') {
    throw new Error('Rollback refused. The target is not a production deployment.');
  }
  if (target.id !== expectedDeploymentId) {
    throw new Error('Rollback refused. Cloudflare returned a different deployment.');
  }
  if (target.latest_stage?.status !== 'success') {
    throw new Error('Rollback refused. The target deployment did not complete successfully.');
  }
}

export function immutableDeploymentUrl(target, project) {
  const url = new URL(String(target?.url ?? ''));
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !/^[a-z0-9-]{6,}\./.test(url.hostname) ||
    !url.hostname.endsWith(`.${project}.pages.dev`)
  ) {
    throw new Error('Rollback refused. The immutable deployment URL is missing or unexpected.');
  }
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

export function assertTargetRelease(release, expectedRevision) {
  if (
    release?.schemaVersion !== 1 ||
    release?.dirty !== false ||
    !revisionsMatch(release?.revision, expectedRevision)
  ) {
    throw new Error(
      'Rollback refused. Target release provenance does not match the approved revision.'
    );
  }
}

export function revisionsMatch(actual, expected) {
  const left = String(actual ?? '').toLowerCase();
  const right = String(expected ?? '').toLowerCase();
  return Boolean(
    left && right && (left === right || left.startsWith(right) || right.startsWith(left))
  );
}
