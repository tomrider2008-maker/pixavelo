# Pixavelo

**Private Image Processing Studio**

Powerful image tools. Completely private.

Pixavelo is a static React application for local browser image processing. The current implementation includes the
production foundation, a verified native core for JPEG/PNG/WebP conversion, the Phase 3 Universal Converter,
Phase 4 advanced-format imports, the enterprise Phase 5 compression/resize workspaces, Phase 6 Batch Studio and the
Phase 7 non-destructive Image Editor, Phase 8 Metadata & Privacy, Phase 9 Web Asset Studio, Phase 10 Professional
Utilities, Phase 11 release hardening, Phase 12 production operations and the locally completed Phase 13
certification controls.

## What is implemented

- Responsive desktop, tablet and mobile application shell.
- Accessible first-run welcome guide with local-only dismissal, Settings re-entry and direct studio navigation.
- Bounded Smart Intake that validates files locally, explains measurable workflow recommendations and preserves the
  user's final studio choice.
- Accessible navigation drawer, command palette, error boundaries, toasts, focus handling and reduced motion.
- Light, dark and system themes with versioned local preferences.
- PWA manifest, offline application cache and accessible work-aware release adoption for long-lived sessions.
- Cloudflare Pages SPA routing and restrictive security headers.
- Magic-byte format detection for JPEG, PNG, WebP, AVIF, BMP, GIF, HEIC/HEIF, TIFF, SVG and ICO.
- Header-level dimension parsing and pixel/file safety limits before supported decoders run.
- Lazy codec registry and browser-native JPEG/PNG/WebP codec capability boundary.
- Native-first AVIF import with a lazy WebAssembly fallback, plus native BMP, GIF and ICO imports.
- Lazy local HEIC/HEIF WebAssembly and TIFF JavaScript decoders, isolated from the startup bundle.
- Strict SVG XML sanitization, active/external-content rejection and a sanitized sequential rasterization path.
- Explicit first-frame, first-page, primary-image and browser-selected ICO size disclosures; advanced formats are
  import-only and never appear as output options.
- Memory-aware worker pool capped from hardware concurrency, with a sequential canvas fallback for WebKit-class
  browsers that lack the worker encoder.
- Real local JPEG → PNG, PNG → JPEG, JPEG → WebP and WebP → JPEG processing.
- Mixed multi-file queues from file selection, drag/drop, folder selection and clipboard images.
- Global conversion presets, per-file format overrides, stage filters, selection controls, cancellation, retry and
  failure isolation.
- Tokenized, sanitized output naming with deterministic duplicate resolution, individual downloads and verified
  local ZIP export.
- Seven quality profiles plus 50 KB–2 MB/custom target presets, quality-only, resize fallback and maximum-visual-
  quality strategies, with every target decision measured against actual encoded Blob bytes in at most 12 passes.
- Output metadata absence checks for JPEG APP1/APP2/APP13, PNG ancillary metadata and WebP EXIF/ICC/XMP chunks.
- Exact, width, height, percentage, maximum-bound, edge and megapixel resize methods; contain, cover, stretch, crop
  and pad fits; original, eight fixed and one custom aspect-ratio choices; no-upscale protection and quarter-turn
  rotation.
- Centralized, dated social presets for Instagram, Facebook, LinkedIn, YouTube, TikTok, X, Pinterest, WhatsApp,
  Discord and Twitch, plus reusable web delivery profiles and verified output dimensions.
- Stage-based progress, cancellation, explicit transparency background, output MIME/size/dimension verification,
  sanitized filenames and local downloads.
- Enterprise batch recipes for format conversion, resize, compression, rotation, flipping, orientation
  normalization, metadata/GPS removal, background application, web optimization, text watermarking and export.
- Failure-isolated batch scheduling with pause/resume/cancel/retry controls, measured throughput and savings,
  verified outputs, saved local presets, duplicate-safe names and virtualized queues tested with 200+ files.
- A non-destructive editor whose immutable transformation recipe supports crop/aspect crop, arbitrary and quarter-turn
  rotation, horizontal/vertical flips, canvas sizing, exposure, brightness, contrast, highlights, shadows,
  saturation, temperature, tint, gamma, sharpness, blur, grayscale and sepia.
- Bounded undo/redo history with reset-current and restore-original actions, standard keyboard shortcuts, original,
  output, slider and side-by-side comparisons, plus Fit/50%/100%/200%/400% zoom and pan.
- Preview rendering from retained source pixels without intermediate compression. The selected output format is
  encoded, signature-checked, dimension-checked and metadata-checked only after explicit export.
- Bounded JPEG, PNG, WebP and leading-TIFF metadata inspection covering general fields, readable EXIF, GPS, XMP,
  IPTC, ICC, author/software signals and embedded thumbnails without loading an entire large source into memory.
- Preserve All, Remove Location Only, Privacy Clean and Remove All policies plus granular category controls. Eligible
  same-format JPEG/PNG/WebP cleaning rewrites container metadata without decoding pixels; other paths use the verified
  local re-encode pipeline with EXIF orientation normalized.
- Post-export policy verification re-inspects actual output bytes. Downloads are enabled only after every selected
  source category is absent; ICC removal carries an explicit color-management warning.
- Responsive WebP/AVIF/JPEG packages with bounded custom breakpoints, verified dimensions and signatures, production
  `<picture>`/`srcset` markup, JPEG fallback and local ZIP export.
- Favicon and application-icon packages with PNG sizes, a multi-size ICO, Apple/PWA icons, web manifest and generated
  head-link markup.
- Seven local professional utilities: configurable watermarking, bounded frame extraction, Base64 encode/decode,
  SHA-256 hashing, sprite-sheet/JSON-map generation, image calculators and versioned preset import/export.
- Collection-wide intake/output/archive budgets, pre-decode dimensions, bounded concurrency, cumulative metadata
  limits, strict imported-state schemas, filename-to-markup safety and deterministic object-URL cleanup.
- Unit, component and Playwright workflow/network tests.
- Automated WCAG A/AA checks, offline navigation tests and Chromium/Firefox/WebKit release gates.
- Automated 120-file real-processing stress coverage, 200+ item virtualization, corrupt-file isolation, 320–1920 px
  responsive checks, static security/network checks, production dependency audit and codec/startup bundle budgets.
- Scheduled production smoke checks for the application shell, security policy and local conversion boundary.
- Immutable semantic-version/Git release provenance, clean-tree deployment refusal, CycloneDX SBOMs and SHA-256
  deployment evidence.
- Hourly production availability verification, daily five-project browser checks, guarded rollback automation,
  operational SLOs, incident handling and physical-device sign-off criteria.
- Digest-protected SLO observations and reporting, executable physical-device evidence validation, non-mutating
  rollback rehearsal, 90-day operational evidence configuration and GitHub issue escalation.

## Local development

Requirements: Node.js 20.19+, 22.12+, or current Node 24.

```bash
npm install
npm run dev
```

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run audit:hardening
npm run audit:operations
npm run test:live
npm run audit:production
npm run release:check
npm run release:artifacts
npm run verify:deployment
```

`npm run check` runs formatting, lint, TypeScript, coverage-enforced unit/component tests and the production build.
`npm run test:e2e` builds once and exercises the production artifact in desktop and mobile Chromium, Firefox and
WebKit projects. `npm run test:live` targets <https://pixavelo.pages.dev> unless `PIXAVELO_BASE_URL` overrides it.
`npm run verify:deployment` performs the lightweight production SLO probe and verifies that the live Git revision
matches the current checkout unless `PIXAVELO_EXPECTED_REVISION` overrides it.

## Cloudflare Pages

- Production URL: <https://pixavelo.pages.dev>
- Deployment mode: Wrangler Direct Upload
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: repository root
- Node version: 24 (or a supported Vite runtime)

The `public/_redirects` file sends deep routes to `index.html`. `public/_headers` applies CSP, MIME sniffing,
referrer, permissions, frame, HTTPS and cache policies. There are no Pages Functions or image Workers.

`npm run release:check` adds the production dependency audit and full browser/device matrix. `npm run deploy:pages`
runs that complete release gate from a clean tree, records release evidence, publishes the verified `dist` directory
and verifies the canonical deployment. It no longer permits `--commit-dirty=true`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Privacy architecture](docs/PRIVACY.md)
- [Browser support](docs/BROWSER_SUPPORT.md)
- [Extending codecs, stages and routes](docs/EXTENDING.md)
- [Security policy](SECURITY.md)
- [Production readiness and release process](docs/PRODUCTION_READINESS.md)
- [Phase 11 hardening evidence](docs/PHASE_11_HARDENING.md)
- [Production SLOs](docs/SLO.md)
- [Operations and rollback runbook](docs/OPERATIONS.md)
- [Physical-device QA matrix](docs/PHYSICAL_DEVICE_QA.md)
- [Phase 12 operations evidence](docs/PHASE_12_OPERATIONS.md)
- [GitHub operations activation](docs/GITHUB_OPERATIONS_ACTIVATION.md)
- [Phase 13 certification and go/no-go](docs/PHASE_13_CERTIFICATION.md)
- [Changelog](CHANGELOG.md)

## Design references

The accepted foundation, Plan 2 and Phase 3–10 desktop/mobile concepts are preserved in `docs/design`.
Application text and controls are implemented as semantic React UI; the concept images are documentation only and
are not shipped as interface code.

## Dependency note

TypeScript is pinned to 5.9 because the current `typescript-eslint` peer range does not yet accept TypeScript 7.
Upgrade them together once the lint toolchain officially supports the newer compiler.

Phase 4 uses `@discourse/heic` and `@jsquash/avif` under Apache-2.0 and `utif` under MIT. See
[`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md) for the runtime dependency boundary.

## Privacy guarantee boundary

The repository includes no analytics and no image-processing network client. Hosted assets and future same-origin
codec resources may be fetched, but selected image binary data is processed locally and is not transmitted by the
implemented workflow.
