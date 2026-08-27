# Physical Device QA Matrix

Physical-device testing is opportunistic QA under the solo-maintainer policy adopted on 2026-08-27. It is recorded
when suitable hardware is available and is not a production release gate. Playwright profiles remain compatibility
signals, not physical-device evidence, and an individual platform is not described as physically certified until the
table is completed using current hardware or a managed real-device service with the evidence link and tester recorded.

An empty, missing or partial evidence directory produces a loud non-blocking warning and lists every uncertified
platform. It never produces a false pass. Completed records still require the full device metadata, checks, evidence
files and matching SHA-256 digests described below.

## Release sign-off

| Platform       | Minimum coverage                                       | Status               | Evidence / tester / date |
| -------------- | ------------------------------------------------------ | -------------------- | ------------------------ |
| Windows        | Current Edge, Chrome and Firefox; laptop and 1080p     | Pending physical run | —                        |
| macOS          | Current Safari, Chrome and Firefox; Retina laptop      | Pending physical run | —                        |
| iOS Safari     | Current and previous major iOS; portrait and landscape | Pending physical run | —                        |
| Android Chrome | Current Chrome; mid-range phone and tablet             | Pending physical run | —                        |

## Required workflow on every device

1. Open the dashboard over HTTPS and verify navigation, theme, keyboard/touch reachability and no horizontal overflow.
2. Install or add the PWA where supported, close it, reopen it and verify an offline deep route.
3. Convert a synthetic PNG to JPEG/WebP, download it and verify the file opens locally.
4. Exercise optimize, resize, batch pause/resume, editor undo/export, GPS cleaning, one Web Asset package and SHA-256.
5. Confirm no permission prompt, account request, image upload or analytics request appears.
6. Leave the app open across a new deployment, return to it and verify the worker adopts the new release cleanly.
7. Process a device-appropriate stress set while watching for tab termination, thermal pressure and unreleased output.

## Layout coverage

Check 320 px mobile portrait, mobile landscape, tablet portrait/landscape, laptop, 1080p and ultrawide where the device
class permits. Record clipping, overlap, scroll traps, focus loss, unreadable controls, canvas blurring and download
behavior.

## Evidence rule

Attach screenshots for the dashboard, one processing result, offline mode and any defect. Record exact OS/browser
versions, device model, available memory class, release version and `/release.json` revision. Synthetic images only;
never put private user media into QA evidence.

## Executable evidence workflow

Create one isolated package per physical platform; `tmp/` is suitable until the reviewed evidence destination is
known:

```bash
npm run certify:device -- init --platform windows --output tmp/device-windows/certification.json
npm run certify:device -- init --platform macos --output tmp/device-macos/certification.json
npm run certify:device -- init --platform ios-safari --output tmp/device-ios/certification.json
npm run certify:device -- init --platform android-chrome --output tmp/device-android/certification.json
```

Create a separate record for each device/browser combination. A complete report requires Edge, Chrome and Firefox on
Windows; Safari, Chrome and Firefox on a Retina macOS laptop; Safari on two adjacent iOS major versions; and Android
Chrome on both a phone and tablet. Windows coverage also requires a recorded 1920×1080 viewport, and every mobile
record requires portrait and landscape evidence.

Perform every check on the named physical device, save synthetic-only screenshots/video/logs beside its JSON record,
and compute each evidence digest with:

```bash
npm run certify:device -- hash --file tmp/device-windows/dashboard.png
```

Fill the exact device, OS, browser, tester, release and evidence references. Set the record to `passed` only after all
seven checks pass. The validator requires a full 40-character revision, HTTPS release URL, complete device/tester
metadata, tested viewports/orientations, evidence for every check, dashboard/processing/offline evidence files,
package-contained relative paths and matching SHA-256 values:

```bash
npm run certify:device -- validate --file tmp/device-windows/certification.json
npm run certify:device -- report --input tmp --output .artifacts/operations/device-certification.json
```

A valid `pending` template is still pending, and the summary is complete only when all four platform families have a
validated passed record. An incomplete summary is retained as a release advisory rather than failing the release.
Emulator, Playwright and desktop responsive evidence must never be relabeled as physical.
