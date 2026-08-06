# Cursor prompt — PR-09 optional brand rename

Do not start this PR until the product owner explicitly approves the final visible product name.

When approved, implement on branch `cursor/pr-09-brand-rename`, cut from the accepted PR-08 integration head. This prompt replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read the integration plan and delivery standard. Use `cda554f` only as a search/reference source, not as a cherry-pick unit.

## Objective

Change user-visible brand copy consistently while preserving all technical identifiers and compatibility contracts unless a separate migration is approved.

## Required implementation

- Replace approved visible brand text in document metadata, auth, navigation, empty/error states, mobile binding, Community publisher display, and relevant user-facing documentation.
- Keep schema identifiers, taxonomy IDs, route paths, storage keys, package names, content IDs, publisher IDs, recipe IDs, and asset IDs stable.
- Distinguish the product brand from publisher/creator names and historical asset attribution.
- Add a single source for product display name where appropriate without introducing a large theming framework.

## Prohibited scope

- No taxonomy, EditorDoc, route, storage, asset, Community-domain, or visual redesign changes.
- No compatibility-breaking search-and-replace.

## Required tests

Add a stale-brand-copy audit with an explicit allowlist for historical/internal references. Run the common gate, then manually inspect auth, Dashboard, Community, Wizard, Editor, confirmation/export, mobile, title/favicon, and error states.

## Acceptance

- Product owner-approved name is consistent in user-visible UI.
- Existing documents, deep links, storage, recipes, and community content still load.
- Remaining old-name occurrences are documented and intentional.
- Diff is copy/metadata-focused and independently revertible.

Return the standard delivery report and the approval reference used.
