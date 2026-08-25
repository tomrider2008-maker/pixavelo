# Physical Device QA Matrix

Playwright profiles are compatibility signals, not physical-device evidence. A release is not signed off for a device
until the table is completed using current hardware or a managed real-device service, with the evidence link and
tester recorded.

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
