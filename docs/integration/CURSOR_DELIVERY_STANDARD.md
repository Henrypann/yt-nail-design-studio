# Cursor delivery and acceptance standard

Every staged PR prompt inherits this standard.

## Start gate

Before editing, print and verify:

```bash
pwd
git status --short --branch
git rev-parse HEAD
git merge-base HEAD integration/community-first-v6
```

The task prompt's PR branch/worktree explicitly replaces the legacy Cursor worktree rule in `AGENTS.md` section 8.4. Do not edit `AGENTS.md` to achieve that replacement. Stop if the actual branch or base is wrong.

## Scope rules

- One product-code writer. Subagents/reviewers are read-only.
- Reference commits are evidence, not cherry-pick units.
- Do not modify main, `exp/cursor-studio-mvp`, or another PR worktree.
- Do not include unrelated formatting, dependency upgrades, generated caches, screenshots outside the evidence folder, or product-wide renames.
- Do not change signed Slot V2 data to make a baseline check green.
- Preserve storage data. No destructive migration, implicit overwrite, or write-on-read.
- Prefer existing dependencies; explain every new runtime dependency.
- Keep Community, Wizard, Editor, renderer, and manufacturing adapters separated by explicit contracts.

## Required delivery report

Return all of the following:

1. branch, base commit, and final commit (or state clearly that commit authorization is still required);
2. files changed grouped by domain;
3. behavior completed and behavior deliberately deferred;
4. exact commands run with pass/fail totals;
5. manual walkthrough matrix and screenshot paths;
6. console/runtime errors observed;
7. migration/storage impact and rollback path;
8. claims classified as production, simulated, fixture-only, or not verified;
9. `git status --short` and `git diff --check` output at handoff.

Do not report “done” when only typecheck/build passes. Any failed required check is a named blocker or an explicitly documented pre-existing baseline result.

## Common automated gate

Run at minimum:

```bash
git diff --check
npm run typecheck
npm run build:integration
npm run test:handdraw
npm run validate-assets
npm run validate-recipes
npm run test:slots
```

Add and run PR-specific tests named in the prompt. If a script name does not exist yet, add a stable package script instead of documenting a one-off command only.

## Common manual gate

- 1280×720 desktop: primary flow and all primary actions visible.
- 1440×900 desktop: no broken max-width, empty dead zones, or overlay collision.
- 390×844 mobile: route remains operable; no horizontal overflow; primary CTA accessible.
- Keyboard: focus order, Escape/close, Enter/Space activation, and visible focus for new interactive elements.
- Refresh/back/forward: no blank page, unintended reset, or duplicate document.
- Console: no repeating severe errors or unhandled promise rejection.
- Empty, loading, invalid, expired, unsupported-version, and missing-asset states are intentionally rendered.

Evidence may be screenshots, traces, and test fixtures. Generated imagery and browser simulation are not evidence of physical manufacturability or real customer try-on.
