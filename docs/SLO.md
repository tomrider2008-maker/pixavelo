# Production Service Objectives

Pixavelo is a static, local-processing application. Its production objectives cover delivery of the application and
verified browser execution; they do not introduce user analytics or image telemetry.

## Availability SLO

- **Objective:** at least 99.9% successful production availability probes over a rolling 30-day window.
- **Successful probe:** HTTPS, application/deep-route shells, release provenance, manifest, service worker, security
  headers and startup assets all meet the checks in `scripts/verify-deployment.mjs`.
- **Measurement:** the pinned `production-smoke.yml` workflow runs the lightweight probe hourly. A full desktop/mobile
  browser matrix runs daily.
- **Latency guardrail:** every shell route must respond within five seconds during the synthetic probe.

## Privacy SLO

- **Objective:** 100% of release and daily production workflow tests complete without an unexpected write request or
  cross-origin image-data request.
- Any observed image upload, analytics request carrying file-derived data or unexpected non-GET/HEAD request is a
  release blocker and a severity-one incident until disproved or remediated.
- Synthetic fixtures contain no user data. Monitoring must never collect filenames, selected images, metadata, GPS,
  canvas pixels, generated files or persistent client identifiers.

## Release integrity SLO

- Every production deployment must be built from a clean Git revision, publish matching `release.json` provenance,
  pass all release gates and retain CycloneDX/file-digest evidence.
- The startup transfer ceiling is 600 KiB. The stricter startup JavaScript, application JavaScript, CSS and codec
  ceilings remain enforced by the production artifact verifier.
- A release whose production revision cannot be verified is considered failed even if its page renders.

## Error budget

The 99.9% monthly availability target permits 0.1% unavailable time, approximately 43 minutes and 50 seconds in a
30-day month. The hourly probe is a discrete synthetic sample rather than continuous timing; its success ratio and
the calendar-time budget must therefore be reported separately. One failed hourly sample triggers investigation and
consumes at least one hour for conservative reporting unless finer evidence proves a shorter impact.

Release and privacy objectives have no planned failure budget. Pause production expansion when either objective is
missed. Resume only after the incident is contained, production is verified and a preventive control is recorded.

## Review cadence

- Review failed checks immediately and the rolling SLO record monthly.
- Review bundle and codec budgets on every dependency change.
- Review the supported physical-device matrix at least quarterly and before a major release.
- Do not claim the 30-day SLO until monitoring has been active for the complete observation window.

## Observation ledger and reporting

Every endpoint run and browser project emits an immutable JSON observation containing the production target, observed
revision where available, objective-specific statuses, measurements, source-report SHA-256 and an evidence hash. The
workflow retains these artifacts for 90 days. Endpoint observations do not claim privacy; only the live Chromium
workflow that executes no-upload assertions may record the daily privacy result.

Aggregate downloaded workflow artifacts with the one verifiable Phase 13 baseline observation:

```bash
npm run report:slo -- --input docs/evidence/phase13 --input tmp/slo-ledger
```

The report requires an endpoint gap no larger than 90 minutes and a privacy-evidence gap no larger than 36 hours over
the entire requested window. It reports sampled availability separately from conservative unavailable hours, verifies
every observation hash, and lists all observed deployment revisions.

Current status on 2026-08-25: one endpoint observation passed availability, release integrity and the five-second
latency guardrail. Privacy was not observed by that endpoint run. The 30-day window is therefore explicitly incomplete.
