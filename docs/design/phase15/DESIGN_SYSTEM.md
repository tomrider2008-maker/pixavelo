# Phase 15 Resize Studio design system

## Product intent

Resize Studio is a focused, professional image workspace that keeps Pixavelo's local-only promise visible without letting privacy copy dominate the task. The hierarchy is deliberately simple: choose a preset, compose on the canvas, confirm the output, then download.

Reference concepts:

- `resize-studio-desktop.png`
- `resize-studio-mobile.png`

## Layout

Desktop uses a three-region studio:

1. Presets and detailed size controls on the left.
2. A dark, image-first canvas with a compact transform toolbar in the center.
3. Output settings, verification, and the primary download action on the right.

Tablet collapses export below the working area. Mobile becomes one column in task order: source, preset rail, canvas, size and crop, export.

The canvas is the visual anchor. Ambient color sampled locally from the selected image is used only as a restrained glow inside the stage.

## Interaction rules

- Settings update the lightweight crop overlay and output estimate immediately.
- Full-resolution processing happens only after **Apply resize**. This prevents expensive work during slider, input, or drag interaction.
- Any transform or output-setting change invalidates a previously verified output.
- Crop mode exposes eight resize handles; Move mode makes the crop selection draggable without accidental handle resizing.
- Rotate, flip, center, reset, zoom, Before, and Output controls are available from the canvas.
- Output preview is enabled only after local processing and decode verification succeeds.
- Smart trim samples a downscaled local bitmap, estimates the background from all four corners, and preserves the full canvas when no distinct content is found.

## Visual language

- Continue Pixavelo's cool neutral surfaces and electric indigo accent.
- Use a charcoal canvas (`#090e18`) to make photography the focal point.
- Cards use 13–16 px radii, fine borders, and quiet elevation.
- Selected presets use a left indigo rail and a subtle accent wash.
- Verified output uses success green; destructive or blocking states retain existing product tokens.
- Typography relies on the product's existing Inter system stack with tighter headings and uppercase micro-labels.

## Accessibility

- Every icon-only tool has an accessible name.
- Toggle states use `aria-pressed`; preset categories retain tab semantics.
- Controls remain at least 42 px high on mobile.
- Processing and verification messages remain live-region compatible.
- Disabled Output preview communicates that processing must complete first.
- Horizontal mobile toolbars and preset rails scroll instead of shrinking touch targets.

## Release copy

- Page: **Resize & transform**
- Support: **Create exact, bounded, social, and web-ready dimensions locally.**
- Primary pre-process action: **Apply resize**
- Primary verified action: **Download image**
- Privacy: **Processed entirely on this device — No upload or remote API.**
