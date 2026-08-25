# Pixavelo Phase 14 premium interface system

Status: implementation reference  
Scope: existing Pixavelo application shell, dashboard, shared controls, dense tool surfaces, and responsive states  
Production policy: branch preview only until the Phase 12 expansion gate is approved

## Product character

Pixavelo should feel like a precise, private creative instrument: calm enough for repeated professional use, distinct enough to be memorable, and dense enough to keep real work efficient. The interface is not a marketing site. Visual expression comes from proportion, typography, tonal depth, and a restrained privacy aura—not decorative content or fake metrics.

Concept references:

- `premium-dashboard-desktop.png`
- `premium-dashboard-mobile.png`

## Color roles

| Role           | Light     | Dark      | Purpose                                  |
| -------------- | --------- | --------- | ---------------------------------------- |
| Canvas         | `#f4f6fb` | `#070b13` | Application background                   |
| Canvas depth   | `#edf1f8` | `#09101b` | Shell and page depth                     |
| Surface        | `#ffffff` | `#0d1420` | Primary controls and panels              |
| Raised surface | `#ffffff` | `#111a28` | Dialogs, floating actions, active panels |
| Muted surface  | `#f1f4f9` | `#141e2c` | Hover and grouped controls               |
| Text           | `#111827` | `#f4f7fb` | Primary copy                             |
| Muted text     | `#536076` | `#9ca8bb` | Descriptions and metadata                |
| Hairline       | `#dce2ec` | `#253247` | Structural boundaries                    |
| Accent         | `#3558f5` | `#6482ff` | Primary action and focus                 |
| Accent strong  | `#2542d8` | `#8299ff` | Hover and selected emphasis              |
| Cyan glint     | `#0891b2` | `#54d5f0` | Rare highlight in privacy aura only      |
| Success        | `#168447` | `#59d78d` | Local/ready status                       |

Accent coverage stays below roughly ten percent of the viewport. Gradients are permitted only on the primary action and low-opacity radial depth behind the intake target.

## Geometry and elevation

- 8px controls, 12px panels, and 16px hero intake surfaces.
- Hairline boundaries define structure; shadows communicate only real elevation.
- Primary controls use a subtle inner top highlight and low, cool shadow.
- Hover moves border/light values, not layout. Pressed controls translate at most 1px.
- Desktop shell: 72px header, 252px navigation rail, 36px status bar.
- Content maximum: 1360px with a 34–42px page gutter.

## Typography

- Use the native modern grotesk stack already shipped by Pixavelo; no font download or tracking dependency.
- Dashboard title: 40–48px desktop, 34px mobile, 760–790 weight, compact line height.
- Tool page title: 28–34px.
- Section title: 14–16px, strong weight, no uppercase kicker.
- Body: 14–16px. Metadata never drops below 11px.
- Use tabular numerals for file sizes, dimensions, progress, and status values.

## Component inventory

### Application shell

- Brand zone with restrained descriptor on wide screens.
- Command trigger centered in the header with visible keyboard shortcut.
- Local-processing status receives a success dot and shield icon, without becoming a decorative badge.
- Navigation active state uses an inset highlight, a slim accent edge, and a low-contrast surface—not a saturated block.
- Status bar remains a compact operational surface; mobile replaces it with bottom navigation.

### Dashboard

- Desktop: intro and primary action at left; large intake surface at right; quick actions and workflow launchers below; recent local jobs after the primary decision surface.
- Mobile: title, full-width primary action, trust line, intake surface, horizontally scrollable quick actions, two-column workflows, fixed bottom navigation.
- Intake surface has one icon, one action label, one concise hint, and one trust cue. It must never imply upload.
- Quick actions are compact direct commands; workflow launchers are larger destinations.

### Shared controls and dense tools

- Primary, secondary, quiet icon, destructive, and segmented-control states share the same border, focus, disabled, and pressed behavior.
- Inputs and selects use a 44px minimum target, a distinct focus boundary, and no placeholder-only labels.
- Tool panels preserve existing information density. Premium styling is applied through tonal grouping, label hierarchy, and disciplined spacing rather than extra containers.
- Empty states remain operational and concise.

## Responsive behavior

- `>= 1180px`: full rail and two-column dashboard composition.
- `768–1179px`: compact header/rail composition; dashboard intake moves below intro where needed.
- `< 768px`: mobile header, no desktop rail/status bar, bottom navigation, single-column intake, scrollable quick actions.
- `< 420px`: safe-area padding, full-width primary actions, 44px touch targets, two-column workflow grid.
- All layouts support 320px without horizontal page overflow; intentional horizontal scrolling is limited to the quick-action rail.

## Accessibility and motion

- Maintain WCAG AA contrast for text and interactive boundaries in both themes.
- Focus is a 3px color-mixed outline plus offset; it must remain visible against accent controls.
- Do not encode status by color alone.
- Honor both `prefers-reduced-motion` and Pixavelo's existing reduced-motion preference.
- Transition only color, border, opacity, shadow, and transform; keep duration between 120–200ms.

## Acceptance points

1. The primary image intake action is visually obvious within one second.
2. The local-only promise is visible in the header and beside the intake surface.
3. Active navigation is clear without overpowering the work surface.
4. Dense conversion/editor controls retain their current workflow and keyboard behavior.
5. Dark and light themes feel deliberately designed, not color-inverted.
6. Mobile exposes the same core actions with no clipped copy or inaccessible target.
7. No network account, upload, telemetry, paid dependency, or external font is introduced.
