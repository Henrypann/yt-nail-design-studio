# Cursor prompt — PR-07 Editor V6 UX and customer-ready output

Implement PR-07 on branch `cursor/pr-07-editor-v6-ux`, cut from the accepted PR-06 integration head. This prompt replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read the integration plan and delivery standard. Use UI/interaction portions of `369d516`, `11f5348`, `171d9e2`, `9b748dd`, and `4382901` as reference material. All code must be v6-native; do not restore V4/V5 stores or public component APIs.

## Objective

Deliver a professional, operable ten-nail editor on the v6 runtime, including direct manipulation, trustworthy state, presentation, and customer-ready preview/export states.

## Required implementation

- Ten-finger strip/overview, one active nail canvas, layer panel, context/inspector panel, and top-level document controls use the v6 store only.
- Single-object select/move/scale/rotate synchronizes canvas, inspector, layer list, undo/redo, autosave, and export.
- Lock, visibility, read-only, capability, hit-testing, tool target, copy/mirror/cross-finger actions, and keyboard shortcuts share one permission/source-of-truth path.
- Reuse the existing mirror contract for L/R mapping, x inversion, thumb compensation, and French-specific behavior; test geometry, not only duplicated data.
- Geometry/finish changes affect the canonical v6 field and all 2D/3D/presentation projections consistently.
- Presentation and export identify their output intent and fallback status. A blank or generic design must not be mislabeled as Mercury Dew or another named recipe.
- Confirmation freezes editing; “new version” creates a distinct editable v6 document without mutating the confirmed one.
- Responsive layout must preserve primary tools and actions at 1280×720 and remain operable at 390×844.

## Known review blockers that must be retested

- SVG/viewBox coordinate mismatch and partial-arc rendering.
- Blank-canvas and Wizard modal/CTA transitions.
- `Layer not found`, lock bypass, inconsistent selected layer/tool state.
- False mirror behavior, weak hit testing, custom-layer semantics.
- Ten-finger overview, export, confirmation/read-only/new-version transitions.
- Title/master/reference changes rolling back or failing to persist.

## Prohibited scope

- No brand rename, locale/taxonomy migration, manufacturing promise, multi-select/groups, or unrequested iPad/Pencil system.

## Required tests

Add stable v6 editor regression and dogfood acceptance scripts. Cover all blockers above, direct manipulation, rapid layer creation, history, autosave/reload, export intent/fallback, generic design labeling, confirmation/new version, unsupported legacy state, missing 3D assets, and error recovery.

Run the common gate and v6 editor scripts. Manual visual/state-transition walkthrough is mandatory at 1280×720, 1440×900, and 390×844 with screenshot/trace evidence. Automation alone cannot pass this PR.

## Acceptance

- No blocking visual or state-transition issue remains in the documented walkthrough.
- One canonical v6 state drives canvas, inspector, layer list, preview, persistence, and export.
- No severe repeating console error and no hidden primary CTA.
- Production/simulated/unverified claims are visibly distinct.

Return the standard delivery report.
