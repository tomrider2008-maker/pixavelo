# Phase 4 browser fixtures

- `hevc32.heif` is the 32×32 HEVC sample from the upstream `strukturag/libheif` fuzzing corpus (LGPL-3.0-or-later project test data).
- `fox.avif` is `fox.profile0.8bpc.yuv420.avif` from the upstream `link-u/avif-sample-images` repository (MIT).

The remaining BMP, GIF, SVG, ICO and TIFF fixtures are generated deterministically in the Playwright test so their expected dimensions and pixels stay visible in the test source.
