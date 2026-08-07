# Cursor prompt — PR-01 Community domain foundation

Implement PR-01 on branch `cursor/pr-01-community-domain`, cut from the exact current head of `integration/community-first-v6`. This task prompt explicitly replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read `docs/integration/README.md` and `docs/integration/CURSOR_DELIVERY_STANDARD.md` first. Follow the common delivery standard.

## Objective

Make Community a real peer product domain that can be entered from Dashboard, Wizard, and Editor and can be browsed without importing Wizard or Editor stores.

Use `57c19db`, `e024797`, `ce6ce3a`, and `e8ef7f9` as reference material. You may reuse Community-only pieces from `84d748f` and `c555361`. Do not cherry-pick these commits wholesale.

## Required implementation

- Add the Community shell and first-level routes for Discover, Official, Creators, content detail, and profile.
- Add domain types, publisher/content repository, official-template adapter, taxonomy contract, filters, trust/capability badges, feed, cards, and validated content fixtures.
- Keep all published content and cover paths valid. Missing media must degrade to an intentional placeholder without layout shift.
- Add a first-level Community entry to the global product navigation. Preserve collapsed navigation labels/tooltips.
- Route entry and exit must not depend on an active Wizard selection.
- Community modules must not import from `src/studio/wizard/**`, `src/studio/editor/**`, or their stores.

## Prohibited scope

- No Studio import intent or Wizard consumption.
- No EditorDoc/model/store changes.
- No global default-locale switch, brand rename, 3D runtime, recommendation changes, or broad TemplateGallery restyle.
- No `AGENTS.md` changes.

## Required tests

Add stable scripts for Community content, taxonomy, and official-template validation. Tests must cover duplicate IDs, invalid publisher/taxonomy references, missing covers, non-published leakage, invalid application level, filter combinations, and badge derivation.

Run the common automated gate plus the new Community scripts. Manually verify Dashboard/Wizard/Editor → Community and Community → Dashboard/Studio at 1280×720, 1440×900, and 390×844. Verify direct deep links and browser refresh.

## Acceptance

- Community is independently navigable and renders valid empty/error states.
- Discover never leaks draft/unpublished content.
- Filters are deterministic and URL/deep-link behavior is documented.
- No Community-to-Studio action mutates Studio state in this PR.
- Diff contains no Editor, Wizard store, brand, or locale changes.

Return the delivery report required by `CURSOR_DELIVERY_STANDARD.md`.
