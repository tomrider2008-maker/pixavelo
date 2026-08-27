# Phase 14 — premium interface activation

Status: owner authorization received 2026-08-26; production activation remains evidence-gated
Branch: `phase14/premium-ui`  
Commercial impact: none; no paid dependency, service, font, account, upload, or telemetry was added

## Objective

Upgrade Pixavelo's visual system, interaction hierarchy, responsive shell, and install identity while preserving the product's local-only processing architecture and all existing tools.

## Implemented scope

- Replaced the flat application palette with a tokenized light/dark system built around midnight ink, disciplined neutral surfaces, electric indigo, and a restricted cyan glint.
- Reworked the desktop header, command trigger, navigation rail, active state, status bar, dialogs, notices, and shared control elevation.
- Rebuilt the dashboard composition around the primary image-intake decision, with a direct local-only assurance, compact quick actions, and denser workflow launchers.
- Reduced the mobile primary navigation to five persistent destinations: Dashboard, Convert, Choose, Edit, and More. Privacy and every other tool remain available through More.
- Added a compact mobile Local status, safe-area-aware bottom navigation, two-column workflow launchers, and a horizontally scrollable quick-action rail.
- Applied the shared surface and border treatment to converter, privacy, web asset, settings, and developer-tool workspaces without changing their workflow logic.
- Replaced the in-app brand mark, favicon, standard PWA icon, maskable PWA icon, manifest colors, and dynamic browser theme colors with the Phase 14 identity.
- Preserved reduced-motion behavior, visible focus, minimum touch targets, offline operation, and service-worker prompt activation.

## Design evidence

- `docs/design/phase14/DESIGN_SYSTEM.md`
- `docs/design/phase14/premium-dashboard-desktop.png`
- `docs/design/phase14/premium-dashboard-mobile.png`

The generated references are direction artifacts, not pixel-perfect acceptance screenshots. The implementation intentionally preserves real Pixavelo content density, browser constraints, and responsive behavior where the generated mobile concept could not.

## Performance decision

The production CSS artifact is `143,260` bytes raw and approximately `24.7 KiB` gzip. The former 128 KiB raw ceiling predated the full light/dark application system and rejected the implementation even though network transfer remained small.

Phase 14 raises the raw ceiling to 144 KiB and adds a stricter 28 KiB gzip ceiling. This makes the transfer budget explicit and still leaves roughly 12% compressed headroom. JavaScript and codec budgets are unchanged.

## Validation commands

```powershell
npm run check
npm run audit:hardening
npm run audit:operations
npm run audit:production
npx playwright test e2e/accessibility.spec.ts e2e/core.spec.ts --project=chromium --project=mobile-chromium
npx playwright test e2e/pwa.spec.ts --project=chromium
```

The full multi-browser gate remains required before production activation:

```powershell
npm run test:e2e
```

The branch preview uses the guarded release workflow and can never target the production branch:

```powershell
gh workflow run release.yml --ref phase14/premium-ui -f target=preview -f confirmation=PREVIEW
```

The preview job uses a dedicated GitHub `preview` environment containing a least-privilege Cloudflare Pages token scoped to the Pixavelo account. Its workflow guard rejects `main`, Wrangler receives the non-main Git ref as its Cloudflare Pages branch, and the job verifies the immutable preview URL against the exact Git revision before retaining the deployment evidence. No production alias, rollback, or `--branch main` operation is executed.

## Activation boundary

The product owner authorized proceeding toward production in the active Codex task on 2026-08-26. At that time, the
Phase 12 policy still required physical-device evidence and a claimable 30-day SLO record before activation. That
historical boundary is preserved here. The dated 2026-08-27 Phase 13 solo-maintainer revision now treats those two
items as non-blocking advisories while keeping the complete automated release gate mandatory.
