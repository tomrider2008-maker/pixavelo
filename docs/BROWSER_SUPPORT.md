# Browser Support and Limitations

## Baseline

The build targets modern browsers with ES2022 and `createImageBitmap`. Chromium and Firefox use module workers,
`OffscreenCanvas`, and `OffscreenCanvas.convertToBlob`; WebKit-class browsers without that encoder use a sequential
`HTMLCanvasElement.toBlob` fallback. Runtime capability and real-encode checks keep processing unavailable when both
boundaries are missing.

The application shell, settings, privacy/help content, and offline cache can still render even if the worker codec
boundary is unavailable.

## Known variability

- JPEG and PNG native decode/encode are broadly available in modern browsers.
- WebP output is probed with a real one-pixel encode before a job starts; MIME fallback is rejected.
- AVIF input is native-first. A local WebAssembly fallback loads only when native decoding fails. AVIF output is not
  presented because Pixavelo cannot verify a broadly reliable browser AVIF encoder.
- HEIC/HEIF input uses a lazy local WebAssembly decoder. Only the primary image is exported; sequences and auxiliary
  images are disclosed but not exported.
- TIFF input uses a lazy local JavaScript decoder. Page 1 is exported and the first-page boundary is always visible.
- GIF input is a static export. Animated files use the first composited frame and the queue discloses this before
  processing. Animated WebP remains outside the Phase 4 input policy.
- BMP and ICO use the browser decoder; ICO uses the embedded size selected by that browser.
- SVG is parsed and serialized through a strict active-content boundary. Scripts, event handlers, external resources,
  foreign HTML, style and animation elements are rejected. Accepted SVG is decoded from a new local Blob and never
  inserted into the document.
- Very large images may fail earlier than Pixavelo's limits because browser/device memory ceilings vary.
- Clipboard button access depends on browser permission policy; keyboard paste remains available when button-initiated
  reading is denied. Folder selection uses the browser's directory-picker file input where supported.
- Phase 3 ZIP export uses the interoperable ZIP32 boundary. A single entry or archive larger than 4 GiB is rejected
  honestly rather than producing a damaged archive.
- Batch pause/resume is cooperative: active encodes finish while paused and no new jobs start. Cancel aborts active
  jobs where the browser pipeline permits and safely marks queued jobs for retry.
- Editor previews are canvas renders from retained source pixels. They may be resolution-capped for responsive
  interaction, but the explicit export always applies the recipe to the original decoded dimensions through the
  verified pipeline. Browser-native encoder differences therefore affect only the final encoded file.
- Native lossy encoders vary slightly by browser. Target-size mode measures the encoder available on the current
  device, caps total work at 12 passes (including at most three dimension fallbacks), and explicitly reports when
  configured quality and dimension floors cannot meet a very small target.
- Social platform dimensions are centralized product presets, not an upload guarantee. Official or common-canvas
  guidance, its source link and the review date are visible in the resize workspace because requirements can change.
- JPEG, PNG and WebP support pixel-preserving metadata policies. TIFF exposes a bounded leading-directory inspection;
  AVIF, HEIC/HEIF, BMP, GIF, SVG and ICO show verified general fields plus an honest parser limitation, and cleaning
  those inputs uses a core-format local re-encode. Compressed or proprietary metadata may be reported as a container
  block without every nested field being decoded.
- Privacy Clean retains ICC profiles by default. Removing ICC can change color-managed appearance. Remove All and
  advanced-format re-encoding normalize EXIF orientation into pixels rather than copying the orientation tag.
- Web Asset Studio uses a lazy local WebAssembly encoder for AVIF output. JPEG and WebP fallbacks remain available;
  encoder load or memory failure is isolated and reported without exposing an unverified download.
- Frame extraction depends on `ImageDecoder` and is presented only when the active browser supports the source type.
  Extraction is capped at 120 frames, 40 MP per frame and 120 MP in aggregate.
- SHA-256 uses Web Crypto. Clipboard copy remains a convenience; generated values and downloads remain available when
  clipboard permission is denied.

## Manual release matrix

Before a production release, verify current Chrome, Edge, Firefox and Safari on desktop plus current iOS Safari and
Android Chrome. Test 320px, mobile portrait/landscape, tablet portrait/landscape, laptop, 1080p and ultrawide layouts.

## Automated release matrix

Every pull request and main-branch push runs the production bundle in Playwright's Chromium, Firefox and WebKit
engines, plus Pixel 7 and iPhone 13 profiles. The matrix covers the application shell, keyboard navigation, WCAG
A/AA automation, the complete core conversion matrix, target-size compression, crop/resize/rotation dimensions,
verified downloads, the complete advanced-input decode matrix, hostile-SVG isolation, mixed-queue failure isolation,
per-file output formats, local ZIP contents, target-size actual Blob bytes, metadata absence, source privacy
inspection, selective GPS removal, post-export category verification, social preset output
dimensions, advanced-input compression, Batch Studio failure isolation, pause/cancel/retry, ZIP verification,
200+ file virtualization, editor source preservation, history, comparison, zoom, explicit export, service-worker control
and mobile overflow. Phase 9–11 coverage adds responsive web/icon packages, seven local utility modes, a 120-file
real-processing stress pass, corrupt-file isolation, hardening-route smoke checks and 320/768/1440/1920 px layout QA.
Chromium and Firefox additionally verify offline deep navigation; WebKit verifies populated
application caches because Playwright's WebKit network emulation cannot reliably navigate while offline.

Phase 12 additionally removes every service-worker registration and application cache in Chromium, reloads the
online shell, verifies a new worker takes control, then proves offline deep-route recovery without write or
cross-origin requests. Release provenance is intentionally excluded from the PWA cache so monitors observe the live
deployment revision.

The scheduled live suite repeats shell, deep-route, manifest, security-header, local-conversion, non-destructive
editor export and verified metadata-location removal checks against `pixavelo.pages.dev`. Playwright WebKit is a
compatibility signal, not a substitute for a physical current-version Safari/iOS Safari release check.
The Phase 12 operations workflow runs a lightweight endpoint/provenance probe hourly and this five-project browser
matrix daily. Physical sign-off remains recorded separately in `docs/PHYSICAL_DEVICE_QA.md`.
