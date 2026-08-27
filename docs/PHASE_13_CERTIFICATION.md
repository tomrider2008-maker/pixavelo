# Phase 13 Production Certification and Operational Activation

## Go/no-go decision — policy revision 2026-08-27

**RELEASE-ELIGIBLE WHEN THE HARD AUTOMATED GATES PASS.** The product owner deliberately revised three Phase 13
requirements that structurally blocked a solo-maintained, static, local-only application:

1. Independent second-reviewer approval is no longer required to merge or deploy. Pull requests and all required
   status checks remain mandatory.
2. Physical-device testing is opportunistic QA. It is recorded and validated when performed but is not a release
   blocker.
3. The rolling 30-day SLO window remains monitored and reported. An incomplete historical window is a visible
   advisory, not a pre-deployment gate.

Pixavelo has no accounts, backend, user database, payments, remote image processor or user-media telemetry. The hard
automated release gate already exercises desktop Chromium, Firefox and WebKit; mobile Chromium and WebKit; WCAG
automation; CSP/static hardening; local/no-upload behavior; dependency vulnerabilities; clean provenance; SBOM and
file-digest evidence. For this risk profile, those repeatable checks are the mandatory deployment controls. The three
external practices above remain valuable evidence without making solo operation impossible.

This policy does not claim that missing evidence passed. Physical coverage remains 0/4 until real records validate,
and the 30-day window remains unclaimable until the reporter proves otherwise.

### Hard release requirements retained

- Protected pull-request flow and strict required status checks.
- Prettier, ESLint with zero warnings and strict TypeScript.
- Unit/component coverage and production build budgets.
- Full Playwright matrix: Chromium, Firefox, WebKit, mobile Chromium and mobile WebKit.
- WCAG A/AA automation and responsive overflow checks.
- Local-processing/no-upload assertions and safe PWA update behavior.
- CSP, static hardening and operational audits.
- Production dependency vulnerability audit.
- Secret scanning, push protection and Dependabot security updates.
- Clean-tree release provenance, pinned actions, CycloneDX SBOM and file digests.
- Linear history, conversation resolution, no force-push/deletion and administrator enforcement.
- Explicit `DEPLOY` confirmation, protected production branch and post-deployment verification.
- Immediate failure/escalation for a current privacy, release-integrity or deployment verification defect.

No automated quality or security check is disabled, weakened or bypassed by this revision.

## Historical go/no-go decision — superseded 2026-08-27

The following decision is preserved as the dated Phase 13 record that applied before the solo-maintainer revision:

> **NO-GO for production deployment or feature expansion.** GitHub repository and production protections were active,
> but the Phase 12 expansion gate still required an independent reviewer, current physical-device evidence and a
> continuous 30-day observation record. Production was to remain unchanged until all three external conditions passed.

The prior external activation gates were:

1. Add a second trusted GitHub collaborator for independent pull-request and production approval.
2. Complete Windows, macOS, iOS Safari and Android Chrome evidence with current physical hardware or a managed
   real-device service.
3. Accumulate uninterrupted hourly availability and daily privacy evidence for the full 30-day window, with
   `claimable30DayWindow: true` and no privacy or release-integrity miss.
4. Re-run the clean release gate and obtain protected independent production approval.

Those requirements were originally selected for an enterprise/team release model. They are not being deleted or
represented as completed; their blocking effect is superseded because a one-person project cannot supply an
independent reviewer and cannot create elapsed time or unavailable hardware on demand.

## Current certification evidence

| Control                                  | Current status            | Release treatment                                                                                             |
| ---------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GitHub remote and Actions                | Active                    | Public repository, pinned selected actions and read-only default workflow token                               |
| Main enterprise CI                       | Passed on `b3910e2…`      | Hard requirement: quality plus all five browser profiles                                                      |
| Safe PWA update lifecycle                | Automated                 | Hard requirement: prompt, active-work deferral and old-client adoption tests                                  |
| Dependabot and vulnerability controls    | Active                    | Hard requirement: production audit, secret scanning and push protection                                       |
| Protected `main`                         | API rule update pending   | Keep PRs and six strict checks; owner must remove only the approval count                                     |
| Protected production environment         | API rule update pending   | Keep protected-branch deployment; owner must remove only the reviewer/self-review rule                        |
| Cloudflare credentials                   | Installed                 | Least-privilege environment secrets; values are never committed or printed                                    |
| Rollback path                            | Contract rehearsal passed | Guarded immutable rollback remains available for a real incident                                              |
| Physical-device matrix                   | Incomplete                | Non-blocking warning; record real evidence when available and never relabel emulation                         |
| Rolling 30-day SLO record                | Incomplete                | Non-blocking warning; hourly/daily monitoring, incident escalation and 90-day retention continue              |
| Current privacy/release-integrity checks | Must pass                 | Hard failure in the release/live workflow; the advisory policy applies only to historical-window completeness |

Canonical production reported release `1.0.0`, revision `cd143531f1d0e1c17e47c9665e1b9c2419488279` when this
revision was prepared. That observation is not a claim that the later premium commits are deployed.

## External activation gates

The former blocking gates are now non-blocking operational practices:

- Run the physical-device matrix when suitable Windows, macOS, iOS and Android hardware is available.
- Retain screenshots, tester/device/browser metadata and SHA-256 evidence for any claimed physical pass.
- Continue hourly endpoint and daily five-browser production monitoring.
- Review the rolling SLO report and investigate every failure or excessive gap.
- Seek peer review for high-risk changes when a trusted reviewer is available.

Branch and environment protections are GitHub API state. Repository work must not silently mutate them. The owner-run
commands that remove only the obsolete approval requirements while preserving automated protection are documented in
`docs/GITHUB_OPERATIONS_ACTIVATION.md`.

## Exact validation commands

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run audit:hardening
npm run audit:operations
npm run audit:production
npm run test:e2e
npm run release:artifacts
npm run verify:deployment
npm run test:live
```

Advisory evidence commands:

```bash
npm run report:slo -- --input docs/evidence/phase13 --input .artifacts/operations
npm run certify:device -- report --input <physical-evidence-directory> --output .artifacts/operations/device-certification.json
```

The advisory commands report incomplete coverage loudly and preserve it in JSON/release evidence without a failing
exit code. Invalid evidence hashes, malformed completed device claims and current automated test failures still fail.
