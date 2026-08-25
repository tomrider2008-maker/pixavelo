import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const status = git(['status', '--porcelain', '--untracked-files=all']);
if (status.length > 0) {
  console.error('Release refused: commit or intentionally ignore every working-tree change first.');
  console.error(status);
  process.exit(1);
}

const revision = git(['rev-parse', '--verify', 'HEAD']);
const packageManifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
if (!/^\d+\.\d+\.\d+$/.test(packageManifest.version)) {
  console.error(`Release refused: ${packageManifest.version} is not a stable semantic version.`);
  process.exit(1);
}

const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
if (!changelog.includes(`## [${packageManifest.version}]`)) {
  console.error(`Release refused: CHANGELOG.md has no ${packageManifest.version} entry.`);
  process.exit(1);
}

console.log(`Clean release candidate ${packageManifest.version} at ${revision.slice(0, 12)}.`);

function git(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Release refused: Git metadata is unavailable (${detail}).`);
    process.exit(1);
  }
}
