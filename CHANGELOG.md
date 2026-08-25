# Changelog

All notable Pixavelo releases are recorded here. Versions follow semantic versioning.

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
