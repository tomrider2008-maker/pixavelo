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
`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets, require reviewer approval as appropriate, and dispatch the
Production release workflow with `DEPLOY`. The workflow uses one concurrency group for releases and rollbacks.

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

1. Stop concurrent releases and record the symptom, first-known time and failing production revision.
2. Run `npx wrangler pages deployment list --project-name pixavelo` and select a previously verified successful
   **Production** deployment. Preview deployments are not valid rollback targets.
3. Review the target's immutable URL and expected Git revision.
4. With least-privilege environment variables set, execute:

```bash
npm run rollback:pages -- --deployment DEPLOYMENT_UUID --expected-revision GIT_REVISION --confirm ROLLBACK
```

The command validates the target before calling Cloudflare's production rollback endpoint, waits for the canonical
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

The service worker uses `skipWaiting`, `clientsClaim`, outdated-cache cleanup and `no-cache` delivery for `sw.js`.
Hashed application assets are immutable. The shell uses Cloudflare Pages' `max-age=0, must-revalidate` policy, and
release provenance uses `no-store`, so neither can be reused without a freshness check.

For a bad worker release, roll back first, confirm that `/sw.js` and `/release.json` expose the restored release, then
reload affected tabs. Closing all Pixavelo tabs and reopening the site allows the active worker to take control. As a
last resort, clear storage for the Pixavelo origin only; warn that in-memory jobs and local preferences may be lost.
The Phase 12 browser test unregisters workers, deletes caches, reinstalls the application and proves offline deep-route
recovery without write or cross-origin requests.

## Maintenance

- Dependabot groups npm production/development updates and checks pinned GitHub Actions weekly.
- Apply production dependency changes only after the full release gate and bundle/codec budget review.
- Review `npm audit`, the CycloneDX SBOM, runtime licenses and the browser/device matrix for every release.
- Rotate Cloudflare tokens according to organizational policy; never commit OAuth or API credentials.
- The scheduled workflows become active only after this repository is hosted on GitHub with Actions enabled.
