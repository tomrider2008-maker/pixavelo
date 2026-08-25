# Phase 13 Production Certification and Operational Activation

## Go/no-go decision

**NO-GO for production deployment or feature expansion.** GitHub operations are now active and the manual production
gate passed, but the Phase 12 expansion gate still requires protected release approval, current physical-device
evidence and a continuous 30-day observation record. The least-privilege Cloudflare Pages token is also not installed.
Production remains unchanged on verified release `1.0.0`, revision
`8b235d47744a25ee0254ddd0282db56549366eab`.

This decision does not claim physical-device certification, an enforced protected branch/environment, a Cloudflare
token, a scheduled-run record, production rollback, Phase 13 deployment or a 30-day SLO record.

## Certification evidence

| Control                                  | Status                    | Evidence / result                                                                                                |
| ---------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Baseline production release              | Verified and unchanged    | Production provenance remains full revision `8b235d…`; no Phase 13 deployment ran.                               |
| GitHub remote and Actions                | Activated                 | Private repository `tomrider2008-maker/pixavelo`; restricted Actions policy and read-only default token.         |
| Main enterprise CI                       | Passed                    | Run `32879231269`: quality plus five browser/device-profile jobs passed.                                         |
| Manual production operations             | Passed                    | Run `32879256015`: endpoint plus Chromium, Firefox, WebKit and both mobile profiles passed.                      |
| Operations escalation                    | Passed                    | Failed run `32878411383` opened issue `#2`; the recovery run was linked and closed it.                           |
| Scheduled hourly/daily execution         | Pending elapsed evidence  | Cron definitions are on default `main`; no actual `schedule` event is claimed yet.                               |
| Safe PWA update lifecycle                | Locally automated         | Accessible prompt, waiting worker, work-aware adoption and controller-change activity guard.                     |
| Old-client-to-new-release behavior       | Passed in Chromium        | A waiting worker held while local work was queued and adopted only after the queue became idle.                  |
| Dependabot and vulnerability controls    | Activated                 | Alerts and automated security fixes enabled; weekly npm/action updates and peer-compatible TypeScript guard.     |
| Protected `main` and production approval | Blocked by GitHub plan    | Private GitHub Free repository cannot enforce branch protection, rulesets or required environment reviewers.     |
| Cloudflare credentials                   | Partial                   | Account ID secret installed; least-privilege Pages API token pending.                                            |
| Rollback path                            | Contract rehearsal passed | Six acceptance/rejection cases; zero network requests and zero production mutations.                             |
| Physical-device matrix                   | Pending real evidence     | Validator and evidence template exist; 0/4 platform families are certified.                                      |
| Rolling SLO record                       | Incomplete                | Seven verified observations, two availability samples, one privacy sample, zero objective failures; not 30 days. |

The local durable baseline is under `docs/evidence/phase13/`. GitHub run `32879256015` retains the manual operations
artifacts for 90 days. These observations verify a point in time only and are not backfilled into a fictitious monthly
record.

## External activation gates

1. Upgrade the private repository to GitHub Pro, then enforce pull requests, required quality/five-browser checks,
   resolved conversations, blocked force-push/deletion, required production reviewers, prevention of self-review and
   no routine administrator bypass. Making the repository public is an alternative only after an explicit source
   publication decision.
2. Create a least-privilege Cloudflare token scoped to Account / Cloudflare Pages / Edit for Pixavelo, install it as
   the `production` environment secret `CLOUDFLARE_API_TOKEN`, and verify it with a read-only Pages project request.
3. Retain and review the first actual hourly endpoint run and first actual daily browser run. Manual dispatch evidence
   does not satisfy this gate.
4. Complete Windows, macOS, iOS Safari and Android Chrome evidence packages with current physical hardware or a
   managed real-device service.
5. Accumulate continuous hourly availability and daily privacy evidence for the full 30-day window. The reporter must
   return `claimable30DayWindow: true` with no privacy or release-integrity miss.
6. Re-run the clean release gate. Only then may an authorized reviewer approve a protected production deployment.

## Accepted risks while blocked

- Production remains on the verified Phase 12 worker, so the Phase 13 work-aware update prompt is not yet available to
  users. Avoid leaving irreplaceable in-memory work open across a deployment.
- The private GitHub Free repository permits direct changes to `main` and environment administrator bypass until the
  plan gate is resolved.
- Release/rollback workflows cannot authenticate to Cloudflare until the Pages API token is installed.
- Playwright device profiles are not physical evidence for hardware downloads, thermal pressure, PWA installation or
  mobile operating-system lifecycle behavior.
- Seven observations prove successful points in time, not monthly availability.

Any privacy or release-integrity miss changes the disposition to incident containment, not conditional approval.

## Exact commands

```bash
npm ci
npm run check
npm run audit:hardening
npm run audit:operations
npm run audit:production
npm run rollback:rehearse
npm run escalate:operations:dry-run -- --availability failure --browser skipped
npm run verify:deployment -- --expected-revision 8b235d47744a25ee0254ddd0282db56549366eab
npm run observe:slo -- --kind endpoint --report .artifacts/operations/deployment-verification.json --status success
npm run report:slo -- --input docs/evidence/phase13 --input .artifacts/operations
npm run certify:device -- report --input <physical-evidence-directory> --output .artifacts/operations/device-certification.json
npm run test:e2e
npm run test:live
gh run view 32879256015 --repo tomrider2008-maker/pixavelo
gh secret list --repo tomrider2008-maker/pixavelo --env production
```

`npm run deploy:pages` and workflow release dispatch are intentionally absent until every external gate above is
satisfied.
