# Pixavelo — Antigravity quick context

## Current production

- Version: `1.0.0`
- GitHub `main` and production revision: `6eab4eb9716bc0e1b001972ed11743f4e1480140`
- Production: <https://pixavelo.pages.dev>
- Immutable deployment: <https://fde8dd6a.pixavelo.pages.dev>
- Production workflow evidence: <https://github.com/tomrider2008-maker/pixavelo/actions/runs/32945407113>

## Product rules

Pixavelo is a local-only image-processing PWA. Preserve these non-negotiable properties:

- No accounts, uploads, backend image processing, analytics or telemetry.
- Image bytes and job history stay on the user's device.
- No paid dependency or service without explicit owner approval.
- Never force-reload while processing work is active. A waiting service worker must use the accessible, work-aware update flow.
- Preserve keyboard access, visible focus, reduced motion, responsive behavior and offline operation.

## Start here

```powershell
git status --short --branch
npm ci
npm run dev
```

Important locations:

- `src/features/` — product workflows
- `src/engine/` — local processing and export logic
- `src/styles/phase14.css` — premium interface layer
- `src/components/feedback/ServiceWorkerUpdate.tsx` — safe PWA upgrades
- `e2e/` and `live-e2e/` — browser and production gates
- `.github/workflows/` — CI, monitoring and guarded releases
- `docs/OPERATIONS.md` — operational commands

## Validation

Use the smallest relevant checks while developing, then run the complete gate before release:

```powershell
npm run check
npm run audit:hardening
npm run audit:operations
npm run audit:production
npm run test:e2e
npm run release:check
npm run test:live
```

## Deployment

Preview branches must use `target=preview` and `confirmation=PREVIEW`. Production requires the exact release commit on `main`:

```powershell
gh workflow run release.yml --ref main -f target=production -f confirmation=DEPLOY
```

Never invent credentials, expose secrets, bypass a failed release gate or claim external evidence that does not exist.

## Pending certification evidence

- Physical-device evidence is still required for Windows, macOS, iOS Safari and Android Chrome.
- The continuous 30-day SLO observation window is not yet claimable.

These pending items must remain explicit in operational reporting even though the owner authorized the current production activation.
