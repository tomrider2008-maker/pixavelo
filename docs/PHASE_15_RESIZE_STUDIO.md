# Phase 15 — Premium Resize Studio

Status: implementation complete on `phase15/resize-studio`; production deployment not performed.

## Delivered

- Premium three-region desktop studio and task-ordered mobile layout.
- Explicit Crop and Move interaction modes.
- Rotate left/right, four fixed orientation presets, horizontal/vertical flip, crop centering, reset, and 25–200% preview zoom.
- Before/output preview switching with output disabled until a locally processed image is verified.
- Stale-output protection: any processing-relevant change removes the old download and requires a new apply operation.
- Deterministic Smart Trim using four-corner background estimation, transparent-canvas support, local downscaled analysis, and safe full-canvas fallback.
- Local ambient canvas treatment sampled from the source image; no upload or external inference.
- Responsive preset rail and toolbar with mobile touch targets and contained page width.
- Updated release wording: **Apply resize** before processing and **Download image** after verification.

## Architecture and safety

The UI does not run full-resolution processing continuously. Lightweight canvas state and geometry estimates update during interaction; encoding starts only after **Apply resize**. Existing verified output is invalidated whenever crop, size, fit, orientation, format, quality, or background changes.

The implementation preserves Pixavelo's local-only architecture. The browser network probe observed no non-GET/HEAD requests during Smart Trim, transform, and export.

## Evidence

- `npm run check`
  - formatting passed
  - repository-wide lint passed with zero warnings
  - TypeScript build passed
  - 36 unit-test files passed; 140 tests passed
  - production build passed
  - release artifact budgets passed: 303 KiB startup JS, 798 KiB application JS, 206 KiB lazy codec JS, 160 KiB raw CSS, 27 KiB gzip CSS
- `npx playwright test e2e/phase15.spec.ts`
  - 3 executed tests passed
  - 7 intentional project-specific skips
  - processing lifecycle and accessibility passed in Chromium
  - mobile containment and touch-control checks passed in mobile Chromium and mobile WebKit
- Existing resize regression probes passed:
  - `npx playwright test e2e/core.spec.ts e2e/phase5.spec.ts --project=chromium -g "resize and rotation|social preset"`
  - 2 tests passed
- In-app browser desktop and 390 × 844 mobile visual inspection passed with no console warnings or errors.

Visual evidence:

- Concept: `docs/design/phase15/resize-studio-desktop.png`
- Concept: `docs/design/phase15/resize-studio-mobile.png`
- Implementation: `docs/qa/phase15/resize-studio-desktop.png`
- Implementation: `docs/qa/phase15/resize-studio-mobile.png`

## Release decision

This feature is intentionally isolated on a feature branch. It is not deployed to `pixavelo.pages.dev`. Merge and production deployment remain separate owner-controlled actions and should use the repository's existing release gate.
