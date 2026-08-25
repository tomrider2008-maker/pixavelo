# Pixavelo Architecture

## Current delivery boundary

Pixavelo is a static React and TypeScript application built by Vite for Cloudflare Pages. Cloudflare serves only
application resources. Image input flows from `File`/`Blob` browser APIs into validation, the codec registry,
the preferred bounded worker pool or a sequential WebKit-compatible canvas fallback, output validation, and a local
object URL for download.

```text
File / Blob
  -> signature and dimension validation
  -> capability-aware codec registry
  -> capability check
  -> bounded module Web Worker, or sequential main-thread fallback
  -> native bitmap decode, or an on-demand AVIF/HEIF/TIFF decoder
  -> strict SVG sanitization and sequential rasterization when applicable
  -> deterministic crop / fit / resize / arbitrary rotation / pixel-adjustment render
  -> one native encode, or a bounded quality-and-dimension target-size search
  -> decode output again to verify dimensions and MIME
  -> inspect output container bytes to confirm metadata absence
  -> Blob URL download, or streamed-CRC local ZIP packaging
```

No image-processing backend exists.

The Phase 8 privacy route can take a pixel-preserving branch before decode: bounded container scanners inventory
metadata, a category policy rewrites or removes eligible JPEG/PNG/WebP metadata blocks, and the resulting Blob is
re-inspected. Whole-metadata removal, format changes, malformed selective candidates and advanced inputs take the
shared decode/re-encode path instead.

The Phase 9 web-asset route uses that same validation/decode boundary, derives a bounded width plan, then encodes and
re-validates every WebP, AVIF and JPEG asset before packaging. AVIF encoding is a lazy local WebAssembly dependency;
it is excluded from startup JavaScript and used only when selected. Generated HTML is built from an ASCII URL-safe
source stem and includes a JPEG fallback.

Phase 10 utilities reuse the shared verified pipeline where pixels are transformed. Frame extraction, Base64, hash,
sprite and preset paths add their own input, aggregate-output and schema limits. Utility presets are versioned,
strictly parsed and stored in IndexedDB; selected files are not persisted.

## Application layers

- `src/app`: router and provider composition.
- `src/components`: reusable brand, feedback, layout, and dialog primitives.
- `src/features`: route-owned product workflows.
- `src/engine`: codec, validation, registry, memory, worker, pipeline, and error boundaries.
- `src/workers`: isolated processing entry points.
- `src/services`: browser persistence and short-lived in-memory file intake.
- `src/stores`: small UI and activity stores. Binary image buffers stay out of global reactive state.
- `src/config` and `src/i18n`: centralized navigation, feature status, and user-facing copy.
- `src/tests` and colocated `*.test.*`: test setup and focused unit/component coverage.

## State boundaries

UI preferences are versioned in local storage. IndexedDB stores are prepared for user-enabled recent job
summaries and presets, but image binaries are not persisted by default. Files selected on the dashboard pass to
the converter through a short-lived in-memory intake session and expire after 30 minutes.

## Universal converter model

The converter keeps source `File` objects and encoded `Blob` outputs inside route-owned queue state rather than a global
store. File picker, folder, drop and clipboard intake all enter the same signature-validation boundary. Each job may
override the global output format; changing byte-affecting settings invalidates completed results so stale output is
never presented as current. Naming changes do not recompress valid output.

Processing requests are submitted together, while the shared memory-aware worker pool decides safe concurrency.
Every job catches its own typed error, so one malformed image cannot reject the queue. Cancel and retry use an
independent `AbortController` per job.

ZIP export uses UTF-8, store-mode ZIP32 because JPEG, PNG and WebP payloads are already compressed. CRC32 is calculated
from each output Blob stream when available, with an older-browser FileReader fallback. Blob parts are passed directly
to the archive rather than concatenating all image bytes into an extra monolithic buffer. Entry names are sanitized
and deduplicated before export.

Before ZIP construction, exports must also fit the 512 MiB practical archive budget. Collection intake accepts at
most 500 files and 512 MiB of source data in deterministic input order; retained output is capped at 512 MiB.

## Codec strategy

The core codec uses browser-native APIs for JPEG, PNG and WebP. AVIF uses that native path first and imports its
WebAssembly fallback only when the browser decoder rejects a verified AVIF input. HEIC/HEIF uses an on-demand
WebAssembly decoder and TIFF uses an on-demand JavaScript decoder. BMP, GIF and ICO use native decoding. SVG passes a
strict XML/active-content boundary before a sanitized local Blob is rasterized sequentially. The registry stores lazy
loader functions so heavy codecs remain split from the startup bundle. A codec advertises
input/output formats, alpha, animation, lossless, quality, metadata, ICC, maximum dimensions, browser dependencies,
and whether it requires WASM.

The Phase 4 codecs have byte budgets enforced by the production artifact check and are runtime-cached only after
first use. Their licenses and responsibilities are recorded in `docs/THIRD_PARTY.md`.

## Worker and memory design

The pool uses `navigator.hardwareConcurrency`, keeps at least one worker, and caps at four. Small tasks may use the
full cap, medium tasks allow at most two medium jobs, and large/extreme jobs run alone. Decoded RGBA memory is
estimated at four bytes per pixel with a 2.5x working-set multiplier.

The worker closes every `ImageBitmap`, drops intermediate canvas state at task completion, transfers output
`ArrayBuffer` ownership, and is recycled after an uncaught worker failure. Cancellation is checked between real
pipeline stages and between target-size encoder attempts.

Advanced pixel decoders return tightly checked RGBA buffers. Header dimensions are checked before decoding where the
container exposes them; decoded dimensions are checked again before a canvas is allocated. Advanced source files that
require a heavy local decoder have a 128 MiB source cap in addition to the shared 120 MP decoded-pixel limit.

When `OffscreenCanvas.convertToBlob` is unavailable, the core uses `HTMLCanvasElement.toBlob` sequentially. The
fallback yields before work, applies the same pixel limits, checks cancellation between stages, closes every
`ImageBitmap`, probes the requested encoder and decodes the output again before exposing a download. It never sends
image data across a network boundary.

## Release and operations boundary

Every build emits a small `release.json` asset containing stable semantic version, full Git revision, commit time and
clean-tree state. It contains no user, machine, token or image information and is served with `no-store` so deployment
verification cannot accept stale provenance. Hashed application assets remain immutable.

Production deployment refuses working-tree changes, retains a CycloneDX production SBOM and SHA-256 file inventory,
then validates the canonical Pages alias. Hourly synthetic checks observe only public static delivery. Daily browser
checks use generated fixtures and assert that local processing emits no write or cross-origin image requests. Rollback
targets an existing successful immutable production deployment; it never mutates an artifact in place.

## Transform and compression model

Crop coordinates are normalized against decoded source pixels before one of ten resize methods resolves requested
dimensions. Contain preserves the complete image, cover performs a centered aspect crop, stretch fills the target,
crop uses the explicit crop rectangle and pad centers the contained result on a chosen background. `preventUpscale`
applies an aspect-preserving constraint, and quarter-turn rotation swaps the verified output axes. Worker and
fallback pipelines share the deterministic geometry module.

Compression profiles are declarative configuration: quality, output format, dimension policy and web-delivery cap
are applied together. Target-size mode is available for JPEG and WebP and offers quality-only, resize-allowed and
maximum-visual-quality strategies. The latter holds a 78% quality floor and reduces dimensions only when that floor
still exceeds the target. The engine probes the actual Blob emitted by the active browser encoder and spends no more
than 12 total attempts across quality binary search and at most three proportional resize fallbacks. It returns the
highest measured quality at or below the requested bytes. If configured floors or minimum dimensions cannot meet the
cap, `targetSatisfied: false` is returned and the UI never claims success. PNG remains lossless and is not presented
as target-size output.

Every output is signature-checked and decoded again to verify its dimensions. A container scanner also verifies that
JPEG APP1/APP2/APP13 segments, PNG metadata chunks and WebP EXIF/ICCP/XMP chunks are absent before the UI displays
“Removal verified.” Social and web preset dimensions live in one typed configuration module; platform guidance is
dated and linked because external requirements can change independently of a release.

## Non-destructive editor model

The Phase 7 editor owns the decoded source and an immutable transformation recipe inside the `/edit` route. Recipe
snapshots contain normalized crop bounds, arbitrary rotation, flips, canvas settings and pixel adjustments; they do
not contain re-encoded intermediates. Preview canvases always render from the retained original, so repeated edits do
not accumulate compression loss.

Undo and redo are reducer transitions across bounded `past`, `present` and `future` recipe stacks. Continuous slider
input merges into a single history entry during a short interaction window, while discrete geometry and filter
actions remain individually reversible. Reset-current changes only the active tool group; restore-original creates a
reversible transition back to the default recipe.

Comparison and zoom are view state, not recipe state. Original-only, output-only, slider and side-by-side views share
the same source/recipe pair, while Fit/50%/100%/200%/400% zoom and pan never change exported dimensions. Only an
explicit export maps the current recipe into the shared worker/main-thread pipeline. That final pass applies geometry,
adjustments, metadata removal, native encoding, MIME signature validation and decoded-dimension validation before a
download URL is exposed.

## Metadata privacy model

Metadata categories are explicit typed policy fields: location, camera/lens, dates, software, author/copyright, whole
EXIF, XMP, IPTC, embedded thumbnail and ICC profile. Inspection reads Blob slices and caps individual metadata blocks
at 8 MiB, container traversal at 4,096 segments/chunks and TIFF directories at 2,048 entries. EXIF values are decoded
only after byte order, type, count, offset and pointed-range checks succeed.

Selective cleaning retains compressed pixel payloads. EXIF private fields are zeroed in place so offsets remain
stable; requested container blocks are omitted, PNG chunks are rebuilt with a new CRC32, and WebP RIFF size plus VP8X
metadata flags are recalculated. Removing location also drops XMP/IPTC blocks because arbitrary schemas can hide
coordinates outside the readable fields. Privacy Clean intentionally retains ICC because it is not private; explicit
ICC and Remove All controls warn about color-management consequences.

Verification compares categories that were actually present in the source with a fresh output inspection. Additional
removals caused by conservative cleaning or re-encoding are reported separately. Preserve All is never represented as
metadata-removed, and a failed selected-category check raises `METADATA_FAILED` before a download URL is exposed.

## Test boundaries

Deterministic validators, SVG policy, TIFF decoding, capability declarations, registries, transform geometry,
editor recipes/history/adjustments, metadata privacy inspection/policies/verification, all
resize methods, fit modes, compression profiles, quality/dimension target search, metadata-container inspection,
social/web preset completeness, responsive image and icon plans, utility preset schemas, ZIP layout/CRC, conversion
naming and presets, filename handling, collection budgets, bounded concurrency, memory calculations
and shared UI primitives have enforced unit-coverage thresholds. Browser-native
workers, service workers and the WebKit canvas fallback are validated in real Playwright engines because DOM emulation
cannot exercise those APIs faithfully.

## Error model

`AppError` is the typed boundary between engine failure details and understandable UI messages. Errors include
unsupported format/browser features, decode/encode failures, unsafe SVG, invalid files, memory/pixel limits, codec
load failure, cancellation, and output validation failure.
