# Cursor prompt — PR-02 Community to Studio intent

Implement PR-02 on branch `cursor/pr-02-community-studio-intent`, cut from the accepted PR-01 integration head. This prompt replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read the integration plan and common delivery standard first. Use `3ccb147` and `0e32099` as reference material, not cherry-pick units.

## Objective

Connect Community to Studio through a small, expiring import-intent contract without allowing Community to depend on Wizard or Editor internals.

## Required implementation

- Define `StudioImportIntentV1` with stable intent ID, created/expiry time, content/publisher IDs, immutable asset reference/version, application level, optional suggested geometry, and allowlisted return route.
- Community may only create an intent for published, non-inspiration-only content with a valid asset reference.
- Studio is the sole consumer. Validate expiry, content identity, template identity, and asset version before applying.
- Add a version-neutral editor repository probe such as `inspectEditorDoc(designId)` / `hasEditorDoc(designId)`. It may inspect raw schema metadata but must not import or expose v3/v4/v5 document types.
- Detect and present separate conflict states: clean, Wizard draft, frozen/confirmed Wizard, existing Editor document.
- Offer explicit “apply to current”, “start new”, and cancel/return behavior where valid. Never overwrite an existing document silently.
- Consume or clear an intent exactly once after success/cancel/invalid state.

## Prohibited scope

- No EditorDoc migration or v6 model yet.
- No Editor UI, recommendation policy, bidirectional Editor-to-Wizard sync, or automatic destructive reset.
- Community modules still cannot import Wizard/Editor stores.

## Required tests

Add stable intent and Community-to-Studio flow scripts. Cover valid, expired, missing, tampered content, asset-version mismatch, inspiration-only, invalid return route, duplicate consumption, refresh, back/forward, Wizard draft, frozen Wizard, existing v3 raw document, synthetic v4/v5/future raw document, and unavailable storage.

Run the common gate and manually walk Community content → Studio → cancel/return, current draft, start new, refresh, and direct deep-link cases.

## Acceptance

- Community only writes the intent envelope; it never writes Wizard or Editor state.
- Any supported or unknown existing editor document triggers a conflict without data loss.
- Invalid/expired intents render a recoverable state rather than a blank route.
- Return targets are internal and allowlisted.

Return the standard delivery report.
