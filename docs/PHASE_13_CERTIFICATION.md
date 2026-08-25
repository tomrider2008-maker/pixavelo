# Phase 13 Production Certification and Operational Activation

## Go/no-go decision

**NO-GO for production deployment or feature expansion.** The safe repository changes are locally certifiable, but
the Phase 12 expansion gate still requires current physical-device evidence and a stable observation record. There is
also no Git remote, so scheduled operations and protected-environment controls are configured but inactive. Production
must remain on verified release `1.0.0` revision `8b235d47744a25ee0254ddd0282db56549366eab`.

This decision does not claim a physical-device pass, GitHub activation, Cloudflare secret installation, production
rollback, production deployment or 30-day SLO record.

## Certification evidence

| Control                                  | Status                       | Evidence / result                                                                    |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Baseline branch and release              | Verified                     | Clean `main` began at `8b235d…`; production provenance matched that full revision.   |
| Live endpoint, integrity and latency     | Passed once                  | 53/53 checks; 425 KiB startup; slowest route 1,752 ms.                               |
| Privacy SLO observation                  | Not observed in endpoint run | Requires the daily Chromium live workflow; no privacy pass was backfilled.           |
| Safe PWA update lifecycle                | Locally automated            | Prompt strategy, waiting worker, work-aware adoption, controller-race guard.         |
| Old-client-to-new-release behavior       | Passed in Chromium           | A real waiting worker held while a local file was queued and adopted after clearing. |
| GitHub Actions and Dependabot definition | Repository-ready             | Pinned workflows, hourly/daily schedules, 90-day evidence and issue escalation.      |
| Protected production environment         | Pending external activation  | Requires GitHub administrator and reviewers.                                         |
| Cloudflare credentials                   | Pending external activation  | No credentials were invented, stored or tested.                                      |
| Rollback path                            | Contract rehearsal passed    | Six acceptance/rejection cases; zero network requests and zero production mutations. |
| Physical-device matrix                   | Pending real evidence        | Validator and evidence template exist; 0/4 platform families are certified.          |
| Rolling SLO record                       | Incomplete                   | One digest-protected endpoint observation; no claimable 30-day window.               |

The durable endpoint source and observation are under `docs/evidence/phase13/`. They record only what the live
verifier actually observed. The supplied Phase 12 browser results remain release evidence, but are not converted into
new daily privacy observations because their retained machine report was not available to this ledger run.

## External activation gates

1. Add and verify the approved GitHub remote; push the reviewed commits to protected `main`.
2. Enable Actions and Dependabot, configure the protected `production` environment and install least-privilege
   Cloudflare environment secrets.
3. Prove one manual production-operations run, the next hourly endpoint run and the next daily browser run, including
   retained observation artifacts and controlled failure escalation.
4. Complete Windows, macOS, iOS Safari and Android Chrome evidence packages with current physical hardware or a
   managed real-device service.
5. Accumulate continuous hourly availability and daily privacy evidence for the full 30-day window. The reporter must
   return `claimable30DayWindow: true` with no privacy or release-integrity miss.
6. Re-run the clean release gate. Only then may an authorized reviewer approve the protected production deployment.

## Accepted risks while blocked

- Production remains on the verified Phase 12 release, whose existing automatic worker activation does not yet show
  the Phase 13 work-aware prompt. Avoid leaving irreplaceable in-memory work open across a deployment.
- GitHub schedules, evidence retention and issue escalation are inert until the repository is hosted and Actions is
  enabled.
- Playwright compatibility profiles are not evidence for hardware download behavior, thermal pressure, PWA install
  surfaces or mobile operating-system lifecycle behavior.
- One endpoint observation proves a point in time, not monthly availability.

Any privacy or release-integrity miss changes the disposition to incident containment, not conditional approval.

## Exact local commands

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
```

`npm run deploy:pages` is intentionally absent from the approved command sequence until every external activation gate
above is satisfied.
