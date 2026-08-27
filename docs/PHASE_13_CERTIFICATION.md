# Phase 13 Production Certification and Operational Activation

## Go/no-go decision

**NO-GO for production deployment or feature expansion.** GitHub repository and production protections are now
enforced, but the Phase 12 expansion gate still requires an independent reviewer, current physical-device evidence
and a continuous 30-day observation record. Canonical production currently reports release `1.0.0`, revision
`cd143531f1d0e1c17e47c9665e1b9c2419488279`; this protection activation did not deploy it.

This decision does not claim physical-device certification, an independently approved Cloudflare deployment,
production rollback, Phase 13 deployment or a 30-day SLO record.

## Certification evidence

| Control                                  | Status                    | Evidence / result                                                                                               |
| ---------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Baseline production release              | Observed and unchanged    | Live provenance reports full revision `cd143531…`; this activation made no production deployment.               |
| GitHub remote and Actions                | Activated                 | Public repository `tomrider2008-maker/pixavelo`; restricted Actions policy and read-only default token.         |
| Main enterprise CI                       | Passed                    | Run `33036366350`: quality plus five browser/device-profile jobs passed on revision `b3910e2…`.                 |
| Manual production operations             | Passed                    | Run `32879256015`: endpoint plus Chromium, Firefox, WebKit and both mobile profiles passed.                     |
| Operations escalation                    | Passed                    | Failed run `32878411383` opened issue `#2`; the recovery run was linked and closed it.                          |
| Scheduled hourly/daily execution         | Active; continuity failed | Schedule events exist, but 2026-08-26 failures and a later gap over 90 minutes invalidate continuity.           |
| Safe PWA update lifecycle                | Locally automated         | Accessible prompt, waiting worker, work-aware adoption and controller-change activity guard.                    |
| Old-client-to-new-release behavior       | Passed in Chromium        | A waiting worker held while local work was queued and adopted only after the queue became idle.                 |
| Dependabot and vulnerability controls    | Activated                 | Security updates, secret scanning and push protection are enabled; weekly npm/action updates remain configured. |
| Protected `main` and production approval | Enforced; reviewer needed | Public-repo protections and self-review prevention are active; only one collaborator currently has access.      |
| Cloudflare credentials                   | Activated                 | Account ID and account-owned Pages Write token installed; read-only project verification passed.                |
| Rollback path                            | Contract rehearsal passed | Six acceptance/rejection cases; zero network requests and zero production mutations.                            |
| Physical-device matrix                   | Pending real evidence     | Validator and evidence template exist; 0/4 platform families are certified.                                     |
| Rolling SLO record                       | Incomplete                | Real schedule evidence exists, but failures/gaps mean there is no claimable continuous 30-day window.           |

The local durable baseline is under `docs/evidence/phase13/`. GitHub run `32879256015` retains the manual operations
artifacts for 90 days. These observations verify a point in time only and are not backfilled into a fictitious monthly
record.

## External activation gates

1. Add a second trusted GitHub collaborator who can independently review pull requests and production deployments.
   Required reviews and self-review prevention must remain enabled.
2. Complete Windows, macOS, iOS Safari and Android Chrome evidence packages with current physical hardware or a
   managed real-device service.
3. Establish a new uninterrupted hourly availability and daily privacy sequence after the latest failure or excessive
   gap, then accumulate the full 30-day window. The reporter must
   return `claimable30DayWindow: true` with no privacy or release-integrity miss.
4. Re-run the clean release gate. Only then may the independent reviewer approve a protected production deployment.

## Accepted risks while blocked

- Production remains on the currently observed `cd143531…` release; the later editor, convert and optimize commits
  remain undeployed while the evidence gate is closed.
- Public source exposure was explicitly approved by the product owner on 2026-08-27. Secret scanning and push
  protection are enabled, but public disclosure remains an accepted product decision.
- With only one collaborator and self-review prevention enabled, protected merges and production deployments remain
  intentionally locked until a second trusted reviewer is added.
- Playwright device profiles are not physical evidence for hardware downloads, thermal pressure, PWA installation or
  mobile operating-system lifecycle behavior.
- Existing observations prove successful points in time, not monthly availability.

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
npm run verify:deployment -- --expected-revision cd143531f1d0e1c17e47c9665e1b9c2419488279
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
