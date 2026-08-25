# Production Readiness

## Release gates

A release is eligible for deployment only when all of the following pass:

1. Prettier, ESLint with zero warnings and strict TypeScript.
2. Unit and component tests.
   Deterministic core modules enforce 65% statement/line, 60% function and 50% branch coverage floors; browser-only
   pipelines are covered by the real-engine matrix.
3. A production build with no public source maps, required Pages controls and enforced bundle budgets.
   The Phase 11 responsive workspaces retain a 340 KiB startup-JavaScript ceiling. Application JavaScript is capped
   at 900 KiB, all JavaScript including lazy codecs at 1,100 KiB, lazy codec JavaScript at 220 KiB and the shared
   stylesheet at 128 KiB. The HEIF decoder, AVIF decoder and AVIF encoder WebAssembly assets have independent 1 MiB,
   1.2 MiB and 3.6 MiB ceilings and remain absent from the startup document.
4. `npm audit --omit=dev --audit-level=high` with no high or critical production findings.
5. Chromium, Firefox and WebKit desktop workflows.
6. Pixel 7 and iPhone 13 responsive workflows.
7. WCAG A/AA automation across the dashboard, converter, optimize, resize, batch, editor, privacy, Web Asset Studio,
   Professional Utilities, security and settings surfaces.
8. PWA manifest and service-worker control in all engines, automatic activation of new releases, and offline deep
   navigation in Chromium and Firefox.
9. Real single and mixed-queue conversion, failure isolation, ZIP entry signatures, target-size compression measured
   against downloaded Blob bytes, metadata absence, exact social output canvases and crop/fit/resize/rotation
   downloads with no image upload requests.
10. HEIC/HEIF, AVIF, TIFF, BMP, GIF, SVG and ICO input fixtures across desktop/mobile browser projects, including
    hostile-SVG rejection and byte-verified PNG outputs.
11. Batch failure isolation, pause/resume/cancel/retry behavior, metadata removal, verified ZIP output and 200+
    item queue virtualization.
12. Editor source preservation, undo/redo, adjustment history, comparison, zoom, mobile reachability and explicit
    verified export across the desktop/mobile browser matrix.
13. Metadata field/GPS inspection, selective location cleaning, ICC-preserving Privacy Clean, whole-metadata
    re-encoding, post-export category verification, mobile reachability and a no-upload assertion.
14. Web Asset Studio responsive WebP/AVIF/JPEG packages, generated `<picture>`/`srcset`, favicon/ICO/app-icon package,
    signature/dimension verification, cancellation, ZIP export, mobile reachability and no-upload assertions.
15. Professional Utilities watermark, frame, Base64, hash, sprite, calculator and local-preset workflows, including
    bounded imported schemas, output verification, mobile reachability and no-upload assertions.
16. Phase 11 stress and failure QA: 120 files processed through the real browser engine, 200+ queue virtualization,
    corrupt-file isolation, four responsive widths and supported-engine hardening-route smoke coverage.
17. Static hardening audit for unsafe DOM/eval/network clients, CSP and Pages controls, source maps, codec isolation and
    PWA artifacts; collection, retained-output, metadata, frame and archive memory budgets have focused unit tests.
18. Live HTTPS, deep-route, browser-console, security-header and Phase 8–11 local-processing smoke checks.
19. Phase 12 clean-tree enforcement, immutable release provenance, CycloneDX SBOM, file-digest evidence and pinned
    CI actions.
20. Hourly endpoint/SLO verification, daily production browser coverage, service-worker recovery and guarded rollback
    automation.

## Release procedure

```bash
npm ci
npm run check
npm run audit:hardening
npm run audit:production
npm run test:e2e
npm run release:artifacts
npm run deploy:pages
npm run verify:deployment
npm run test:live
```

`npm run deploy:pages` uses Cloudflare Pages Direct Upload for the `pixavelo` project, refuses a dirty working tree,
repeats all gates and verifies the canonical deployment afterward. CI deployment should use a least-privilege
Cloudflare API token stored in a protected environment; OAuth credentials must not be committed. Retain the generated
SBOM and release-evidence digest with the immutable deployment UUID.

## Rollback

Cloudflare retains immutable deployment versions. If the live smoke suite fails after publication, run the guarded
rollback workflow/command or promote the last known-good production deployment in the Pages dashboard, then verify
its `/release.json` revision and repeat the live suite. Do not attempt to repair a broken production release in place.
See `docs/OPERATIONS.md` for the exact command and incident procedure.

## Operational boundaries

- The application has no server-side image-processing service and intentionally emits no image telemetry.
- Production monitoring is synthetic and privacy-preserving: availability, headers, rendering and generated test
  image conversion only.
- Browser automation does not replace the physical Safari/iOS Safari and Android Chrome release checklist.
- Advanced formats are import-only. First-frame/page/primary-image boundaries are product behavior, not temporary
  omissions, and must remain disclosed until multi-frame/page export is implemented.
- Scheduled workflows require a GitHub-hosted repository with Actions enabled. The 30-day SLO and physical-device
  rows remain pending until their external evidence windows are completed.
