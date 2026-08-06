# Cursor prompt — PR-05 Wizard recommendation and V6 bridge

Implement PR-05 on branch `cursor/pr-05-wizard-v6-bridge`, cut from the accepted PR-04 integration head. This prompt replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read the integration plan and delivery standard. Use `492de62`, the Wizard portions of `0e32099`, `369d516`, `11f5348`, and `84d748f` as reference material.

## Objective

Close the Community → Wizard → Editor flow using the v6 repository, with one explicit recommendation policy and recoverable draft/conflict behavior.

## Required implementation

- Canonical recommendation rule: at most two curated styles plus one concept slot. Keep partitioning deterministic and testable.
- Validate referenced templates/assets before recommendation or application; a missing concept asset must degrade without blocking curated options.
- Consume validated Community intents only through the PR-02 consumer boundary.
- Persist and restore Wizard draft state on refresh. URL/deep-link overrides have documented precedence.
- Apply an intent only after explicit conflict choice; preserve existing/frozen/editor-backed work unless the user chooses a new design.
- The Wizard-to-Editor bridge creates or updates a v6 document exactly once at the documented transition.
- Keep the bridge one-way. Do not promise Editor-to-Wizard save-back.

## Prohibited scope

- No editor UI redesign, 3D renderer, taxonomy/locale rename, Community shell changes, or bidirectional synchronization.
- No schema-specific conflict check outside the repository probe.

## Required tests

Add stable Wizard recommendation, draft recovery, and v6 bridge scripts. Cover 0/1/2/3+ curated results, concept availability, missing/invalid assets, repeated modal open, Community intent current/new/cancel, draft/frozen/editor conflict, refresh, query precedence, double-click/duplicate transition, existing v6 doc protection, and unsupported future doc protection.

Run the common gate and all new scripts. Manually walk Community content → Studio recommendation → Step 2 → Editor, including cancel, back, refresh, and “start new”.

## Acceptance

- The complete path creates one valid `EditorDocV6` and preserves the selected content/template/geometry intent.
- No existing editor document is overwritten implicitly.
- Recommendation cards and CTA remain usable at 1280×720 and 390×844.
- Missing optional assets do not create blank screens or broken modal state.

Return the standard delivery report.
