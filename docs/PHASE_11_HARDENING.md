# Phase 11 Hardening Evidence

Phase 11 treats availability, output integrity, privacy and honest browser capability as release boundaries. The
application remains a static, local-processing Cloudflare Pages deployment: it has no image upload endpoint, account
surface, server-side processor or analytics client.

## Security review

A repository-wide standard security scan reviewed 175 focused source-file passes across the baseline, file-processing
and platform surfaces. It reported seven medium and two low findings. No remote-code-execution, authentication,
authorization, credential, upload or server-side issue was found.

All nine findings were remediated before release:

| Finding                                           | Release control                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Decoder allocation before reliable dimensions     | Supported images must expose bounded header dimensions before a decoder runs; decoded dimensions are checked again.            |
| SVG size check after string allocation            | The 5 MiB SVG source budget is enforced from `File.size` before `File.text()`.                                                 |
| Unbounded batch intake and retained output        | Intake is capped at 500 files/512 MiB and retained output at 512 MiB, with four-task validation/processing concurrency.        |
| Frame extractor bypassed shared validation        | Frame extraction re-enters central validation and caps frame count, axes, per-frame pixels, aggregate pixels and output bytes. |
| Converter buffered every file before scheduling   | Validation and conversion use an ordered bounded-concurrency mapper instead of an unbounded `Promise.all`.                     |
| Generated HTML accepted filename metacharacters   | Source stems are normalized to bounded ASCII URL-safe slugs before HTML/srcset generation.                                     |
| Imported utility preset ranges were trusted       | Presets use a versioned, size-limited, enum/range/color-checked parser before state mutation.                                  |
| Metadata blocks had no cumulative retained budget | Inspection has 32 MiB/128-block cumulative metadata retention ceilings in addition to per-block bounds.                        |
| Web-asset ZIP object URL survived unmount         | The latest ZIP URL is tracked independently and revoked on replacement and unmount.                                            |

Additional defense-in-depth range-checks batch recipes loaded from local storage before any value can reach the
processing pipeline.

## Resource budgets

- Collection intake: 500 files and 512 MiB aggregate source bytes.
- Validation and eager processing: four concurrent tasks.
- Retained encoded output: 512 MiB per workspace.
- Practical ZIP construction: 512 MiB before payload reads, plus the existing ZIP32 boundary.
- Decoded image: 120 MP shared limit; heavy decoder source files: 128 MiB.
- SVG source: 5 MiB before text allocation.
- Metadata retained during inspection: 32 MiB and 128 blocks.
- Frame extraction: 120 frames, 40 MP per frame, 32,768 px per axis and 120 MP aggregate.

## Automated acceptance matrix

`npm run release:check` is the single pre-deployment gate. It requires:

1. Prettier, zero-warning ESLint and strict TypeScript.
2. Coverage-enforced unit/component tests and production build verification.
3. Static hardening audit for unsafe DOM/eval/network behavior, CSP/Pages controls, PWA assets, codec isolation and
   source-map absence.
4. No high or critical production dependency advisory.
5. Chromium, Firefox, WebKit, Pixel 7 and iPhone 13 workflows.
6. Automated WCAG A/AA, offline/PWA, no-upload and responsive QA.
7. Real 120-file browser processing with bounded DOM and heap-growth assertion, 200+ item virtualization and corrupt
   file isolation.
8. Startup, application, CSS and lazy codec/WebAssembly bundle ceilings.

The Phase 11 stylesheet ceiling is 128 KiB. It was deliberately increased from 120 KiB for the two responsive Phase
9/10 workspaces while preserving a hard build failure and leaving 3.7 KiB of measured headroom in the release
candidate.

The live suite is run after deployment and repeats HTTPS, security-header, deep-route and local-processing checks
against the published Cloudflare Pages artifact.

## Residual platform boundaries

Third-party AVIF/HEIF/TIFF codec internals are isolated behind bounded lazy imports and verified outputs, but are not
claimed as formally verified. Browser and device memory ceilings can still reject work below Pixavelo's product
limits. Playwright WebKit is a compatibility signal; a physical current Safari/iOS Safari and Android Chrome pass
remains part of the manual release matrix.
