# Extending Pixavelo

## Add a codec

1. Implement the `ImageCodec` capability contract in `src/engine/codecs`.
2. Export a lazy loader that performs runtime feature detection and loads heavy code only when requested.
3. Register it in `src/engine/registry/defaultRegistry.ts`.
4. Add unit tests for registry selection and capability truthfulness.
5. Add real integration fixtures for each advertised conversion path.
6. Document browser, animation, alpha, metadata, ICC, memory and license limitations.

Do not add a format to visible supported-output controls until a real output Blob has been encoded, MIME-checked,
decoded again and covered by browser tests.

## Add a processing stage

Define a serializable recipe field and worker protocol change, implement the stage inside the worker, emit a real
stage update, release replaced buffers/bitmaps, and add deterministic tests. Keep UI-specific state outside the
engine. Shared pixel geometry belongs in `src/engine/pipeline/geometry.ts`; asynchronous bounded encoder searches
belong in isolated helpers such as `encodeToTarget.ts` so worker and fallback behavior cannot drift.

## Add a route or tool

Add the route through lazy loading in `src/app/router.tsx`, centralize navigation/copy, and reuse validation/registry/
pipeline APIs. Keep unfinished tools behind capability status and explain why they are unavailable.

## Add persistence

Create a versioned IndexedDB store migration. Never persist image binaries by default, and never include image or
metadata values in logs. Provide a user-visible setting before saving recent job summaries.

## Add an export format

Keep export packaging separate from image encoding. Sanitize and deduplicate every entry name, use Blob parts rather
than copying completed outputs where possible, support cancellation during expensive validation, and add a byte-level
test for headers, checksums and directory records. Do not expose archive controls until completed outputs remain
individually downloadable if packaging fails.
