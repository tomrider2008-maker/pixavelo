# Phase 12 Production Operations Evidence

Phase 12 turns the Phase 11 release candidate into an operationally controlled static product. It preserves the local,
no-account and no-upload architecture.

## Implemented controls

- Stable `1.0.0` release identity and deterministic `/release.json` provenance derived from Git.
- Clean-tree deployment refusal and removal of Wrangler's dirty-deployment override.
- CycloneDX production SBOM, per-file SHA-256 inventory and aggregate deployment digest.
- Executable live deployment checks for routes, headers, provenance, PWA files, immutable assets, latency and transfer
  budgets.
- Guarded, target-validated Cloudflare Pages rollback through the documented REST endpoint.
- Pinned CI supply-chain actions, weekly npm/action maintenance and retained release/failure evidence.
- Hourly lightweight availability checks plus a daily Chromium/Firefox/WebKit and mobile browser matrix.
- Service-worker/cache-loss recovery coverage and explicit operational recovery instructions.
- Availability, privacy and release-integrity SLOs, incident handling and physical-device sign-off criteria.

## Acceptance status

| Acceptance item                           | Status                                                                          | Evidence                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Reproducible clean release and provenance | Automated                                                                       | `release:clean`, `verify-build.mjs`, `/release.json`        |
| Release gates and supply-chain evidence   | Automated                                                                       | `release:check`, `.artifacts/release/`                      |
| Privacy-preserving production monitoring  | Automated configuration                                                         | `production-smoke.yml`, `verify-deployment.mjs`, live tests |
| Tested rollback mechanism                 | Guard and API contract automated; production rollback intentionally not invoked | `rollback-pages.mjs`, protected workflow                    |
| PWA recovery                              | Automated                                                                       | `e2e/phase12.spec.ts`                                       |
| Performance regression budgets            | Automated                                                                       | artifact and live startup-transfer checks                   |
| Physical current-device matrix            | Pending advisory evidence                                                       | `docs/PHYSICAL_DEVICE_QA.md`                                |
| 30-day 99.9% observation window           | Pending advisory observation                                                    | `docs/SLO.md`                                               |

The pending rows are evidence that necessarily accrues outside a single build. They are not represented as passed.
Scheduled GitHub monitoring also requires the repository to be hosted with Actions enabled; local commits alone do not
start schedules.

## Historical expansion gate

Phase 13 should not change production until the new release passes the device matrix and the operational checks have
produced a stable observation record. Any privacy or release-integrity miss pauses expansion immediately.

This was the Phase 12 policy and is preserved as historical release evidence. On 2026-08-27 the owner adopted the
documented Phase 13 solo-maintainer revision: physical-device coverage and the complete 30-day history remain tracked
but no longer block deployment. Current automated privacy and release-integrity failures still pause releases.
