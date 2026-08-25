# Third-party runtime codecs

Pixavelo keeps advanced decoders behind dynamic imports and does not send source bytes to a remote service.

| Package           | Version    | License    | Runtime responsibility                                                      |
| ----------------- | ---------- | ---------- | --------------------------------------------------------------------------- |
| `@discourse/heic` | 1.0.0      | Apache-2.0 | HEIC/HEIF primary-image decode through a libheif/libde265 WebAssembly build |
| `@jsquash/avif`   | 2.1.1      | Apache-2.0 | AVIF decode fallback and selected Web Asset Studio AVIF encoding            |
| `utif`            | 3.1.0      | MIT        | TIFF page-1 decode to RGBA                                                  |
| `pako`            | transitive | MIT        | Compression support used by UTIF                                            |

The production verifier enforces separate advanced-codec asset budgets and rejects a release if the HEIF or AVIF
WebAssembly asset is missing or leaks into the startup document. Service-worker runtime caching begins only after an
advanced codec is requested.
