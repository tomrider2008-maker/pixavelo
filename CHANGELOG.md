# Changelog

All notable Pixavelo releases are recorded here. Versions follow semantic versioning.

## [Unreleased]

### Added

- Phase 13 work-aware PWA update prompt and old-client-to-new-release browser coverage.
- Digest-protected SLO observations/reporting, executable device evidence validation and a no-network rollback rehearsal.
- GitHub-ready 90-day operational evidence, scheduled failure escalation and activation/certification runbooks.

### Changed

- 2026-08-27: Reclassified independent review, physical-device coverage and the 30-day SLO window as visible
  solo-maintainer advisories; every automated quality, browser, accessibility, security and release-evidence gate
  remains mandatory.
- Waiting service workers no longer force activation while local work is queued or processing.
- Live rollback now verifies the immutable deployment's release provenance before production mutation.
- GitHub operations are active with restricted Actions permissions, Dependabot, 90-day evidence and failure
  escalation; protected approvals remain an explicit external gate, while least-privilege Cloudflare credentials are
  installed in the production environment.
- Operational evidence tools now support absolute Windows output paths.
- Primary actions switch disabled/enabled color pairs atomically so WebKit never observes transient low contrast.

## [1.0.0] - 2026-08-25

### Added

- Complete local image-processing platform delivered through Phases 1–11.
- Phase 12 production operations: immutable release provenance, CycloneDX SBOM and file-digest evidence.
- Clean-tree deployment enforcement, live endpoint verification and a guarded Cloudflare Pages rollback command.
- Hourly availability probes, daily five-project production browser checks and retained failure evidence.
- Pinned GitHub Actions, weekly dependency maintenance, operational SLOs, incident response and device QA runbooks.
- Automated recovery coverage for removed service-worker registrations and application caches.

### Security

- Production remains a static browser application with no image upload endpoint, analytics client, account backend or
  remote image processor.
