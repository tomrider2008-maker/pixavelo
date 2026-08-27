# Production Operations Runbook

## Production boundary

The canonical service is `https://pixavelo.pages.dev`. Cloudflare Pages serves immutable static assets and the SPA
shell; there are no Pages Functions, accounts, analytics or remote image-processing endpoints. Synthetic operations
use generated fixtures only.

## Release procedure

Prerequisites are Node.js 24, a clean committed revision and an authenticated Wrangler session or a least-privilege
Cloudflare token with Pages Write access.

```bash
npm ci
npm run release:clean
npm run release:check
npm run release:artifacts
npm run deploy:pages
```

`deploy:pages` repeats the clean-tree and full release gates before Direct Upload, rejects dirty deployments and runs
the live endpoint verifier after publication. The build emits `/release.json` with semantic version, full Git
revision, commit time and clean-tree state. `.artifacts/release/` contains a CycloneDX production SBOM and SHA-256
digest inventory; retain these with the deployment record.

For GitHub-hosted operation, configure the protected `production` environment and the
`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets, then dispatch the Production release workflow with `DEPLOY`.
The solo-maintainer policy does not require an independent reviewer; protected branches, explicit confirmation and
all automated release checks remain mandatory. The workflow uses one concurrency group for releases and rollbacks.
The complete GitHub activation, branch-protection and least-privilege secret inventory is in
`docs/GITHUB_OPERATIONS_ACTIVATION.md`.

## Post-deployment verification

```bash
npm run verify:deployment
npm run test:live
```

The endpoint verifier checks HTTPS, deep routes, cache and security headers, release identity, manifest, service
worker, immutable same-origin startup assets, response guardrails and transfer budgets. The browser suite proves the
shell plus representative local processing, verified downloads and no-upload behavior across five projects.

Do not promote or announce a release until both checks pass. Record the immutable `*.pixavelo.pages.dev` deployment
URL, deployment UUID, revision, version, evidence digest and verification result.

## Rollback procedure

Rehearse the shared rollback contract before selecting a live target:

```bash
npm run rollback:rehearse
```

This local rehearsal makes no network request and performs no mutation. It proves confirmation, production-target,
successful-stage, immutable-host and release-revision rejection paths using the same contract imported by the live
rollback command.

1. Stop concurrent releases and record the symptom, first-known time and failing production revision.
2. Run `npx wrangler pages deployment list --project-name pixavelo` and select a previously verified successful
   **Production** deployment. Preview deployments are not valid rollback targets.
3. Review the target's immutable URL and expected Git revision.
4. With least-privilege environment variables set, execute:

```bash
npm run rollback:pages -- --deployment DEPLOYMENT_UUID --expected-revision GIT_REVISION --confirm ROLLBACK
```

The command validates the target and fetches its immutable `/release.json` before calling Cloudflare's production
rollback endpoint, waits for the canonical
alias to expose the expected provenance and writes a rollback record under `.artifacts/operations/`. The protected
Production rollback workflow provides the same guarded path. The Cloudflare Pages dashboard's **Rollback to this
deployment** action is the documented fallback.

After rollback, run `npm run verify:deployment -- --expected-revision GIT_REVISION` and `npm run test:live`. Do not
delete the failed deployment until incident evidence and its release artifacts have been retained.

## Incident response

### Severity

- **SEV-1:** suspected image-data transmission, malicious release, broad outage or corrupted downloads.
- **SEV-2:** primary workflow unavailable, PWA update loop, incompatible production headers or material regression.
- **SEV-3:** isolated browser/device defect with a documented workaround.

### Response

1. Confirm the canonical URL and `/release.json`; never request a user's private image to reproduce an incident.
2. Preserve the failing workflow report, release evidence, deployment UUID, browser/OS version and synthetic fixture.
3. For SEV-1, stop releases and roll back immediately to the last verified revision.
4. For SEV-2, roll back when a safe fix cannot be verified within the active error budget.
5. Verify production after containment, document root cause and add a regression control before resuming expansion.

## Service-worker recovery

The service worker uses prompt-based activation, `clientsClaim`, outdated-cache cleanup and `no-cache` delivery for
`sw.js`. A waiting worker shows an accessible **New version available** action. If local files are queued or processing,
the action schedules adoption and the client does not activate or reload until work becomes idle. A controller-change
race is checked against the live activity store before reload. Hashed application assets are immutable. The shell uses
Cloudflare Pages' `max-age=0, must-revalidate` policy, and release provenance uses `no-store`.

For a bad worker release, roll back first, confirm that `/sw.js` and `/release.json` expose the restored release, then
reload affected tabs. Closing all Pixavelo tabs and reopening the site allows the active worker to take control. As a
last resort, clear storage for the Pixavelo origin only; warn that in-memory jobs and local preferences may be lost.
The Phase 12 browser test unregisters workers, deletes caches, reinstalls the application and proves offline deep-route
recovery without write or cross-origin requests. The Phase 13 browser test installs a byte-distinct waiting worker and
proves old-client work is retained until safe adoption.

## SLO evidence operations

The hourly endpoint and daily browser jobs write digest-protected `slo-observation-*.json` files and retain them for 90
days. Download observation artifacts into one directory and run:

```bash
npm run report:slo -- --input docs/evidence/phase13 --input tmp/slo-ledger
```

The report rejects modified evidence hashes, deduplicates observations and requires continuous hourly endpoint plus
daily privacy coverage before setting `claimable30DayWindow` to true. Workflow failures open or update one GitHub issue
linked to the failing run. No user filename, image, metadata, pixel, download or persistent identifier is recorded.
An incomplete 30-day window is emitted as a visible release advisory and does not change the reporter's evidence
integrity rules or the hard failure behavior of current privacy/release checks.

## Maintenance

- Dependabot groups npm production/development updates and checks pinned GitHub Actions weekly.
- Apply production dependency changes only after the full release gate and bundle/codec budget review.
- Review `npm audit`, the CycloneDX SBOM and runtime licenses for every release; record opportunistic physical-device
  coverage when suitable hardware is available.
- Rotate Cloudflare tokens according to organizational policy; never commit OAuth or API credentials.
- The schedules are installed on the GitHub default branch. Treat them as operationally observed only after actual
  hourly and daily `schedule` event records exist; a manual dispatch proves the workflow, not the scheduler.
