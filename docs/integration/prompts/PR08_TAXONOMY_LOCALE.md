# Cursor prompt — PR-08 Taxonomy and locale compatibility

Implement PR-08 on branch `cursor/pr-08-taxonomy-locale`, cut from the accepted PR-07 integration head. This prompt replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read the integration plan and delivery standard. Split `c555361` by concern; use only taxonomy, centralized-label, and locale changes that satisfy compatibility requirements.

## Objective

Establish one US-market nail-element taxonomy and shared label resolver for Community, Wizard, and Editor without coupling stored IDs to the display language or breaking legacy documents.

## Required implementation

- Document canonical machine IDs, English labels, Chinese labels where supported, hierarchy, aliases, deprecations, and ownership.
- Keep stored Community content, Wizard selections, recipes, layers, and EditorDocV6 locale-neutral.
- If a Cursor label change also changed an ID, keep the stable ID or add an explicit alias/migration with fixtures.
- Centralize label resolution. Community, Wizard, and Editor must not maintain divergent inline label maps.
- An English default locale is allowed only if language switching remains functional across auth, dashboard, Community, Wizard, Editor, errors, confirmation, and export/presentation states.
- Missing labels fall back deterministically without exposing raw undefined values.

## Prohibited scope

- No Editor schema bump, brand rename, broad UI restyle, storage-key rename, or silent destructive ID rewrite.

## Required tests

Add/extend stable taxonomy and locale tests. Cover duplicate IDs/aliases, unknown/deprecated IDs, both locales, fallback, Community content fixtures, Wizard selection, v1-v5 migrated documents, v6 save/reload, recipes/layers, and language switching without data mutation.

Run the common gate plus Community taxonomy and taxonomy-enum tests. Manually switch languages on all primary domains and verify deep links/refresh.

## Acceptance

- One machine ID produces consistent labels across all three product domains.
- Changing locale changes display text only, not persisted document/content IDs.
- Legacy IDs still load and save through a documented alias/migration path.
- No brand rename appears in this PR.

Return the standard delivery report and an ID/alias compatibility table.
