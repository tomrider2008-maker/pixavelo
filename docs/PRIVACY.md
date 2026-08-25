# Privacy Architecture

Pixavelo processes supported images locally. This build contains no analytics, accounts, remote upload endpoint,
cloud image storage, or server-side processing.

## Network boundary

Allowed network requests load the static application, icons, service worker, and same-origin lazy codec assets.
The Content Security Policy restricts connections to the same origin. End-to-end tests reject non-GET/HEAD requests
during the core and advanced conversion matrices and reject requests to non-local origins in the test environment.

## Browser storage

- Local storage: versioned theme, motion and history preferences.
- IndexedDB: reserved for local presets and user-enabled recent job summaries.
- Cache Storage: static application resources managed by the service worker.
- Memory: selected `File` objects, decode inputs and output object URLs during an active session.

Recent job storage is disabled by default. Image binaries are not written to persistent application storage.
Professional Utility presets contain configuration only, use a versioned bounded schema and are parsed again on
import. Batch recipes loaded from local storage are range-checked before they can reach the processing pipeline.

## Collection and memory boundary

File intake is limited to 500 entries and 512 MiB of aggregate source data. Validation and eager processing use a
four-task concurrency ceiling, retained encoded output is capped at 512 MiB, and ZIP creation rejects archives over
the same practical budget before reading entry payloads. Frame extraction additionally caps frame count, per-frame
pixels and aggregate decoded pixels. These limits keep hostile or accidental local input from causing unbounded
browser allocation while preserving failure isolation.

## Sensitive logging

Production code does not log filenames, metadata, GPS values, thumbnails, raw buffers, or image contents. Development
render errors log only the error message and React component stack.

## Metadata privacy workspace

The `/privacy` route reads container metadata with bounds-checked JPEG segment, PNG chunk, WebP RIFF and leading-TIFF
directory scanners. A single metadata block is capped at 8 MiB and a container scan at 4,096 segments/chunks. The
inspector exposes only understandable values and never logs them.

Four policies are available:

- **Preserve all** keeps a same-format core image byte-identical when possible and does not claim removal.
- **Remove location only** scrubs GPS entries and conservatively removes XMP/IPTC blocks that may carry location.
- **Privacy Clean** removes readable location, camera/lens, date, software, author, XMP, IPTC and thumbnail data while
  preserving the ICC color profile and technical EXIF container where safe.
- **Remove all metadata** re-encodes through the shared verified pipeline so orientation is applied to pixels and no
  source metadata block is copied.

JPEG, PNG and WebP selective cleaning is pixel-preserving when the container is well-formed. If a safe rewrite cannot
be guaranteed, Pixavelo falls back to a full local re-encode and discloses additional removals. Explicit ICC removal
warns that color-managed appearance can change.

Every output is inspected again against the selected policy. The interface says metadata was removed only when a
category existed in the source and the corresponding output evidence is absent. A failed verification produces no
approved download.
