# COMM-V7.1-03 · Nail Board — Validation

Date: 2026-08-11
Base: integration/community-v7-1 after COMM-V7.1-02 (Explore & Search)
Branch: codex/pr-comm-v7-1-03-nail-board
HEAD: (see `git rev-parse HEAD` at review time; worktree is a linked tree of the
primary repo, branch `codex/pr-comm-v7-1-03-nail-board`)

Evidence level: **production-ready local contract + repository + UI logic** over a
disclosed local-demo identity and versioned browser-local storage. Real auth,
backend sync, manufacturing/device integration and Made claims are explicitly
NOT implemented or claimed.

## Scope and contracts

- `NailBoardV1` is a reference collection: items carry exact references
  (`lookId` + `designVersionId`, or an explicitly declared legacy-unversioned
  reference with `designVersionId: null`). No EditorDoc, customer/private
  NailProfile, manufacturing definition or device parameter is copied or
  accepted (strict parsers reject unknown keys).
- Strict runtime parsers (`parseNailBoardV1` / `parseBoardShareLinkV1` /
  `parseNailBoardStoreV1`) never throw, never mutate input, reject unknown
  keys, bad timestamps/revision/visibility, duplicate item ids and duplicate
  dedupe keys (sourceKind + lookId + exact designVersionId), canonical/legacy
  reference mismatches, forbidden private keys at any depth, non-hex share
  token hashes, duplicate boards and shares pointing at missing boards.
- Pure commands never mutate input; mutating commands return fresh state and
  bump `revision`; no-op commands return `changed: false` with the same
  reference. The repository enforces `expectedRevision` (optimistic
  concurrency → `revision_conflict`) and writes at most once per successful
  command, zero bytes on no-op/failure. Reorder/delete storage failure keeps
  the previous canonical/UI state (verified byte-identical storage).
- New boards are always PRIVATE. PUBLIC requires an explicit
  `publicConfirmed: true` (UI confirm modal); PRIVATE boards are never
  anonymously shareable; UNLISTED requires a valid unexpired/unrevoked token;
  PUBLIC is readable by link but never editable by anonymous viewers.
- Share tokens: 32 Web Crypto random bytes → base64url, SHA-256 hex persisted
  only. The raw token is returned exactly once for URL construction and is
  never stored. Share URL `/community/board/share/:token` carries no
  owner/customer identity.
- Save: Feed owns the Save-to-Board dialog. Canonical looks save as
  CANONICAL_VERSIONED; legacy static looks save as LEGACY_UNVERSIONED with an
  explicit "unversioned inspiration reference" caveat. Already-saved state is
  displayed from real repository state; success is only shown after confirmed
  persistence (no fake success, no optimistic residue).
- No collaboration, collage, likes, Three.js, backend, or Editor/Wizard store
  imports in any board file.

## Routes

- `/community/boards` — list + create (default PRIVATE disclosure,
  empty/error/retry, corrupted-storage disclosure).
- `/community/board/:boardId` — owner rename, visibility control + PUBLIC
  confirm, share link create/copy/revoke (shown-once URL), ordered items with
  accessible Move up/down and Delete, unavailable/deleted/version-unavailable
  item states, missing/forbidden states, board delete with confirm.
- `/community/board/share/:token` — anonymous read-only; invalid/expired/
  revoked/PRIVATE/error states; no owner actions exposed.

## Automated gates

- `npm run typecheck` — PASS
- `npm run build:integration` — PASS
- `npm run test:community-v7-1-nail-board` — PASS (new: parsers, forbidden
  fields, default private, public confirmation, idempotent save, canonical/
  legacy dedupe, atomic delete/reorder failure, revision conflict, no shared
  refs, crypto token hash / no raw storage, expiry/revoke/access matrix,
  unavailable look/version mapping, routes/card wiring, no EditorDoc/
  manufacturing copy)
- `npm run test:community-v7-1-explore-search` — PASS (Save assertions updated
  from "disabled until COMM-03" to onSave wiring)
- `npm run test:community-v7-1-look-adapter` — PASS
- `npm run test:community-domain` — PASS
- `npm run test:community-content` — PASS
- `npm run test:community-intent` — PASS
- `npm run test:community-studio-flow` — PASS
- `git diff --check` — PASS

Primary review additionally closed two contract/persistence defects before
acceptance: a future-expiring link may be revoked before expiry without making
the store unparsable, and browser storage read failures now fail closed instead
of being mistaken for an empty writable store. Both have regression coverage.

## Honest boundaries (not claimed)

- **Local-demo identity**: `LOCAL_DEMO_IDENTITY_ID` is disclosed in the UI and
  the source; there is no real auth, no backend sync, no multi-device
  consistency. Boards live in browser-local storage only (versioned key
  `nail-board-store-v1`, runtime-parsed, fail-closed on corruption).
- **Static fixtures**: all current looks are LEGACY_PARTIAL with no
  designVersionId — every Save in the demo is a legacy-unversioned inspiration
  reference; canonical versioned references are implemented, tested and
  enforced, but no canonical fixture exists yet to exercise them end-to-end.
- **Not implemented**: collaboration, likes, collage, Three.js previews,
  server-side share links, expiry notification, manufacturing/device/Made
  claims. Made remains `—` everywhere.

## Browser walkthrough

Executed by the primary reviewer against `http://127.0.0.1:5213`:

- Discover → Save Mercury Dew → create default-PRIVATE Board → save Micro
  Coquette to the same Board; both are honestly labelled legacy-unversioned.
- Board detail: reorder Micro Coquette above Mercury Dew; switch PRIVATE →
  UNLISTED; create one-time raw share URL; open anonymous read-only view; revoke
  link and verify explicit revoked state; switch to PUBLIC only through the
  confirmation dialog.
- Anonymous share exposed no rename, visibility, share-management, reorder,
  delete or edit action. The raw token was only shown in the owner session;
  automated storage coverage proves only its SHA-256 hash persists.
- Responsive headless-Chrome checks at 1440/1280/1024/768/390 all reported
  `scrollWidth === clientWidth` and zero console/page errors. Screenshots and
  metrics are under `screenshots/`. The 390 Board detail additionally reported
  zero undersized controls owned by this PR; the new create/title/date inputs
  were raised to a 44px minimum. Existing Community shell header/debug controls
  below 44px remain a disclosed pre-existing shell issue, outside COMM-03.

## Files changed

- src/app/routes.ts, src/app/App.tsx, src/app/layouts/CommunityLayout.tsx
- src/community/components/CommunityLookCard.tsx, CommunityFeed.tsx
- src/community/components/NailBoardSaveDialog.tsx (new),
  NailBoardVisibilityControl.tsx (new)
- src/community/data/board-repository.ts (new)
- src/community/domain/v7_1/nail-board.ts (new)
- src/community/pages/CommunityBoardsPage.tsx (new),
  CommunityBoardPage.tsx (new), CommunityBoardSharePage.tsx (new)
- tools/test-community-v7-1-nail-board.mjs (new),
  tools/test-community-v7-1-explore-search.mjs (updated)
- package.json (test script)
- evidence/pr-comm-v7-1-03-nail-board/VALIDATION.md (this file)
