#!/usr/bin/env node
/**
 * test-community-v7-1-nail-board.mjs · COMM-V7.1-03
 * Nail Board 领域/仓储/接线纯行为测试。
 *
 * Covers:
 *  - strict parsers: unknown keys (incl. EditorDoc / manufacturing / device /
 *    private data), bad timestamp/revision/visibility, duplicate itemIds and
 *    duplicate dedupe keys, canonical/legacy reference mismatches, forbidden
 *    private keys, share token-hash format, store integrity (duplicate boards,
 *    share→missing board);
 *  - default PRIVATE on create; PUBLIC requires explicit confirmation;
 *  - idempotent save (zero write on no-op); canonical/legacy dedupe;
 *  - atomic delete/reorder failure (throwing storage → error, zero writes,
 *    canonical state preserved); revision conflict; no shared references;
 *  - Web Crypto token: raw token returned once, only SHA-256 hash persisted,
 *    no raw token in storage JSON;
 *  - expiry / revoke / access matrix (owner / anonymous / other identity /
 *    PRIVATE / UNLISTED / PUBLIC);
 *  - unavailable look/version view mapping;
 *  - routes / card / feed / pages wiring, Boards nav, package script,
 *    and no EditorDoc/manufacturing copy anywhere in the board data path.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const domain = await import(
  pathToFileURL(path.join(root, 'src/community/domain/v7_1/nail-board.ts')).href
);
const repoModule = await import(
  pathToFileURL(path.join(root, 'src/community/data/board-repository.ts')).href
);
const { Routes } = await import(pathToFileURL(path.join(root, 'src/app/routes.ts')).href);

const {
  NAIL_BOARD_SCHEMA_VERSION,
  createBoardCommand,
  createShareCommand,
  deleteItemCommand,
  parseBoardShareLinkV1,
  parseNailBoardStoreV1,
  parseNailBoardV1,
  renameBoardCommand,
  resolveBoardAccess,
  resolveItemViewState,
  revokeShareCommand,
  saveItemCommand,
  setVisibilityCommand,
  boardItemDedupeKey,
} = domain;
const {
  BoardRepository,
  LOCAL_DEMO_IDENTITY_ID,
  anonymousAccessProvider,
  localDemoAccessProvider,
  webCryptoToken,
} = repoModule;

const T0 = '2026-08-11T00:00:00.000Z';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Fixed-clock, counter-id, in-memory storage repository harness. */
function makeRepo() {
  let stored = null;
  const writes = [];
  const state = { failWrites: false };
  const storage = {
    read: () => stored,
    write: (value) => {
      writes.push(value);
      if (state.failWrites) throw new Error('quota exceeded');
      stored = value;
    },
  };
  let clock = T0;
  let counter = 0;
  const repo = new BoardRepository({
    storage,
    clock: { now: () => clock },
    id: { nextId: () => `id-${(counter += 1)}` },
    token: webCryptoToken,
    access: { getAccess: localDemoAccessProvider },
  });
  return {
    repo,
    storage,
    writes,
    setClock: (iso) => {
      clock = iso;
    },
    setFailWrites: (flag) => {
      state.failWrites = flag;
    },
  };
}

function ownerContext(identityId = LOCAL_DEMO_IDENTITY_ID) {
  return { authenticated: true, identityId, disclosure: 'local_demo' };
}

function anonymousContext() {
  return { authenticated: false, disclosure: 'none' };
}

/** Build a valid board via the public parser path (never hand-rolled). */
function validBoardInput(overrides = {}) {
  return {
    schemaVersion: 1,
    boardId: 'board-1',
    ownerIdentityId: LOCAL_DEMO_IDENTITY_ID,
    title: 'Wedding inspiration',
    visibility: 'PRIVATE',
    items: [],
    revision: 1,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function canonicalItem(overrides = {}) {
  return {
    itemId: 'item-1',
    lookId: 'cc_mercury_dew',
    sourceKind: 'CANONICAL_VERSIONED',
    designVersionId: 'design-v-1',
    savedAt: T0,
    ...overrides,
  };
}

function legacyItem(overrides = {}) {
  return {
    itemId: 'item-2',
    lookId: 'cc_mercury_dew',
    sourceKind: 'LEGACY_UNVERSIONED',
    designVersionId: null,
    savedAt: T0,
    ...overrides,
  };
}

async function createBoard(repo, title = 'My board') {
  const result = repo.createBoard(title);
  assert.equal(result.ok, true, `createBoard must succeed: ${result.message ?? ''}`);
  return result.value.board;
}

// ---------------------------------------------------------------------------
// 1 · Strict parsers
// ---------------------------------------------------------------------------
{
  const parsed = parseNailBoardV1(validBoardInput());
  assert.equal(parsed.ok, true, 'valid board parses');
  assert.equal(parsed.ok ? parsed.value.visibility : '', 'PRIVATE');

  const withItems = parseNailBoardV1(
    validBoardInput({ items: [canonicalItem(), legacyItem()] }),
  );
  assert.equal(withItems.ok, true, 'board with canonical+legacy items parses');

  // unknown keys — including EditorDoc / manufacturing / device / private keys
  for (const badKey of [
    'editorDoc',
    'editorDocRef',
    'recipeInstances',
    'manufacturingDefinition',
    'deviceTask',
    'workOrder',
    'slotProfiles',
    'waveform',
    'customerId',
  ]) {
    const bad = parseNailBoardV1(validBoardInput({ [badKey]: 'x' }));
    assert.equal(bad.ok, false, `unknown key "${badKey}" must be rejected`);
    assert.ok(bad.issues.some((issue) => issue.code === 'unknown_key'), `unknown_key issue for ${badKey}`);
  }

  // bad timestamp / revision / visibility
  assert.equal(parseNailBoardV1(validBoardInput({ createdAt: 'yesterday' })).ok, false, 'bad createdAt rejected');
  assert.equal(parseNailBoardV1(validBoardInput({ updatedAt: 123 })).ok, false, 'non-string updatedAt rejected');
  assert.equal(parseNailBoardV1(validBoardInput({ revision: 0 })).ok, false, 'revision 0 rejected');
  assert.equal(parseNailBoardV1(validBoardInput({ revision: 1.5 })).ok, false, 'fractional revision rejected');
  assert.equal(parseNailBoardV1(validBoardInput({ visibility: 'SECRET' })).ok, false, 'unknown visibility rejected');
  assert.equal(parseNailBoardV1(validBoardInput({ title: '   ' })).ok, false, 'blank title rejected');

  // duplicate itemId
  const dupIds = parseNailBoardV1(
    validBoardInput({ items: [canonicalItem(), canonicalItem({ itemId: 'item-1', designVersionId: 'design-v-2' })] }),
  );
  assert.equal(dupIds.ok, false, 'duplicate itemId rejected');
  assert.ok(dupIds.issues.some((issue) => issue.code === 'duplicate_item'), 'duplicate_item issue');

  // duplicate dedupe key (same sourceKind + lookId + designVersionId)
  const dupRef = parseNailBoardV1(
    validBoardInput({ items: [canonicalItem(), canonicalItem({ itemId: 'item-9' })] }),
  );
  assert.equal(dupRef.ok, false, 'duplicate reference (dedupe key) rejected');

  // reference mismatches
  const canonicalNull = parseNailBoardV1(
    validBoardInput({ items: [canonicalItem({ designVersionId: null })] }),
  );
  assert.equal(canonicalNull.ok, false, 'CANONICAL_VERSIONED with null designVersionId rejected');
  assert.ok(canonicalNull.issues.some((issue) => issue.code === 'reference_mismatch'), 'reference_mismatch issue');
  const legacyNonNull = parseNailBoardV1(
    validBoardInput({ items: [legacyItem({ designVersionId: 'design-v-1' })] }),
  );
  assert.equal(legacyNonNull.ok, false, 'LEGACY_UNVERSIONED with non-null designVersionId rejected');

  // forbidden private keys at any depth
  const privateLeak = parseNailBoardV1(
    validBoardInput({ items: [legacyItem({ itemId: 'item-3', lookId: 'other-look' })], note: { email: 'a@b.c' } }),
  );
  assert.equal(privateLeak.ok, false, 'forbidden private key rejected');
  assert.ok(privateLeak.issues.some((issue) => issue.code === 'forbidden_private_key'), 'forbidden_private_key issue');

  // share parser: bad token hash, unknown keys
  const goodShare = {
    schemaVersion: 1,
    shareId: 'share-1',
    boardId: 'board-1',
    tokenHash: 'a'.repeat(64),
    createdAt: T0,
  };
  assert.equal(parseBoardShareLinkV1(goodShare).ok, true, 'valid share parses');
  assert.equal(
    parseBoardShareLinkV1({
      ...goodShare,
      expiresAt: '2026-08-20T00:00:00.000Z',
      revokedAt: '2026-08-12T00:00:00.000Z',
    }).ok,
    true,
    'a share may be revoked before its future expiry',
  );
  assert.equal(
    parseBoardShareLinkV1({ ...goodShare, expiresAt: '2026-08-10T00:00:00.000Z' }).ok,
    false,
    'expiry before creation is rejected',
  );
  assert.equal(
    parseBoardShareLinkV1({ ...goodShare, revokedAt: '2026-08-10T00:00:00.000Z' }).ok,
    false,
    'revocation before creation is rejected',
  );
  assert.equal(
    parseBoardShareLinkV1({ ...goodShare, tokenHash: 'NOT-HEX' }).ok,
    false,
    'non-hex tokenHash rejected',
  );
  assert.equal(
    parseBoardShareLinkV1({ ...goodShare, tokenHash: 'A'.repeat(64) }).ok,
    false,
    'uppercase hex tokenHash rejected',
  );
  assert.equal(parseBoardShareLinkV1({ ...goodShare, rawToken: 'secret' }).ok, false, 'rawToken key rejected');
  assert.equal(
    parseBoardShareLinkV1({ ...goodShare, customerId: 'cust-1' }).ok,
    false,
    'customerId key rejected',
  );

  // store parser: duplicate boards, share → missing board, unknown keys
  const storeInput = {
    schemaVersion: 1,
    kind: 'NAIL_BOARD_STORE',
    boards: [validBoardInput()],
    shares: [goodShare],
    updatedAt: T0,
  };
  assert.equal(parseNailBoardStoreV1(storeInput).ok, true, 'valid store parses');
  assert.equal(
    parseNailBoardStoreV1({ ...storeInput, boards: [validBoardInput(), validBoardInput()] }).ok,
    false,
    'duplicate boardId rejected',
  );
  assert.equal(
    parseNailBoardStoreV1({ ...storeInput, shares: [{ ...goodShare, boardId: 'board-zzz' }] }).ok,
    false,
    'share referencing missing board rejected',
  );
  assert.equal(
    parseNailBoardStoreV1({ ...storeInput, editorDoc: {} }).ok,
    false,
    'store unknown key (editorDoc) rejected',
  );
}

// ---------------------------------------------------------------------------
// 2 · Default PRIVATE + create command
// ---------------------------------------------------------------------------
{
  const created = createBoardCommand({
    boardId: 'board-new',
    ownerIdentityId: LOCAL_DEMO_IDENTITY_ID,
    title: '  New Board  ',
    now: T0,
  });
  assert.equal(created.ok, true, 'create succeeds');
  if (!created.ok) throw new Error('unreachable');
  assert.equal(created.state.board.visibility, 'PRIVATE', 'new boards are always PRIVATE');
  assert.equal(created.state.board.title, 'New Board', 'title trimmed');
  assert.equal(created.state.board.revision, 1, 'revision starts at 1');
  assert.deepEqual(created.state.board.items, [], 'empty items');

  const bad = createBoardCommand({
    boardId: 'board-new',
    ownerIdentityId: LOCAL_DEMO_IDENTITY_ID,
    title: '   ',
    now: T0,
  });
  assert.equal(bad.ok, false, 'blank title rejected');
}

// ---------------------------------------------------------------------------
// 3 · PUBLIC requires explicit confirmation; visibility transitions
// ---------------------------------------------------------------------------
{
  const created = createBoardCommand({ boardId: 'b', ownerIdentityId: 'owner-1', title: 'B', now: T0 });
  if (!created.ok) throw new Error('unreachable');
  const state = created.state;

  const noConfirm = setVisibilityCommand(state, { visibility: 'PUBLIC', now: T0 });
  assert.equal(noConfirm.ok, false, 'PUBLIC without publicConfirmed fails');
  if (!noConfirm.ok) assert.equal(noConfirm.code, 'public_not_confirmed', 'error code');

  const withConfirm = setVisibilityCommand(state, { visibility: 'PUBLIC', publicConfirmed: true, now: T0 });
  assert.equal(withConfirm.ok, true, 'PUBLIC with publicConfirmed succeeds');
  if (!withConfirm.ok) throw new Error('unreachable');
  assert.equal(withConfirm.state.board.visibility, 'PUBLIC', 'board is PUBLIC');
  assert.equal(withConfirm.state.board.revision, 2, 'revision bumped');

  const toUnlisted = setVisibilityCommand(state, { visibility: 'UNLISTED', now: T0 });
  assert.equal(toUnlisted.ok, true, 'PRIVATE → UNLISTED allowed without confirmation');

  const backToPrivate = setVisibilityCommand(withConfirm.state, { visibility: 'PRIVATE', now: T0 });
  assert.equal(backToPrivate.ok, true, 'PUBLIC → PRIVATE allowed');

  const idempotent = setVisibilityCommand(state, { visibility: 'PRIVATE', now: T0 });
  assert.equal(idempotent.ok && idempotent.changed === false, true, 'same visibility is a no-op');
}

// ---------------------------------------------------------------------------
// 4 · Idempotent save + canonical/legacy dedupe + no input mutation
// ---------------------------------------------------------------------------
{
  const created = createBoardCommand({ boardId: 'b', ownerIdentityId: 'owner-1', title: 'B', now: T0 });
  if (!created.ok) throw new Error('unreachable');
  let state = created.state;
  const inputSnapshot = JSON.stringify(state);

  const first = saveItemCommand(state, {
    itemId: 'item-a',
    lookId: 'look-1',
    sourceKind: 'CANONICAL_VERSIONED',
    designVersionId: 'v1',
    savedAt: T0,
    now: T0,
  });
  assert.equal(first.ok && first.changed === true, true, 'first save changes');
  if (!first.ok) throw new Error('unreachable');
  state = first.state;

  const second = saveItemCommand(state, {
    itemId: 'item-b',
    lookId: 'look-1',
    sourceKind: 'CANONICAL_VERSIONED',
    designVersionId: 'v1',
    savedAt: T0,
    now: T0,
  });
  assert.equal(second.ok && second.changed === false, true, 'same dedupe key is idempotent no-op');
  assert.equal(second.ok ? second.state === state : false, true, 'no-op returns the same state reference');
  assert.equal(state.board.items.length, 1, 'no duplicate item appended');
  assert.equal(JSON.stringify(created.state), inputSnapshot, 'commands never mutate input');

  // canonical v1 vs v2 are distinct; legacy null vs canonical v1 are distinct
  const v2 = saveItemCommand(state, {
    itemId: 'item-c',
    lookId: 'look-1',
    sourceKind: 'CANONICAL_VERSIONED',
    designVersionId: 'v2',
    savedAt: T0,
    now: T0,
  });
  assert.equal(v2.ok && v2.changed === true, true, 'different designVersion is a distinct item');
  const legacy = saveItemCommand(v2.ok ? v2.state : state, {
    itemId: 'item-d',
    lookId: 'look-1',
    sourceKind: 'LEGACY_UNVERSIONED',
    designVersionId: null,
    savedAt: T0,
    now: T0,
  });
  assert.equal(legacy.ok && legacy.changed === true, true, 'legacy-unversioned is distinct from canonical');
  assert.equal(
    boardItemDedupeKey({ sourceKind: 'LEGACY_UNVERSIONED', lookId: 'look-1', designVersionId: null }),
    boardItemDedupeKey({ sourceKind: 'LEGACY_UNVERSIONED', lookId: 'look-1', designVersionId: null }),
    'legacy dedupe key deterministic',
  );
  assert.notEqual(
    boardItemDedupeKey({ sourceKind: 'LEGACY_UNVERSIONED', lookId: 'look-1', designVersionId: null }),
    boardItemDedupeKey({ sourceKind: 'CANONICAL_VERSIONED', lookId: 'look-1', designVersionId: 'v1' }),
    'legacy null and canonical v1 never dedupe',
  );

  // invalid reference inputs are rejected before any change
  const badCanonical = saveItemCommand(state, {
    itemId: 'item-z',
    lookId: 'look-2',
    sourceKind: 'CANONICAL_VERSIONED',
    designVersionId: null,
    savedAt: T0,
    now: T0,
  });
  assert.equal(badCanonical.ok, false, 'canonical save without designVersionId rejected');
  assert.equal(state.board.items.length, 1, 'rejected save does not mutate');
}

// ---------------------------------------------------------------------------
// 5 · Repository: revision conflict, idempotent save, atomic failure, no shared refs
// ---------------------------------------------------------------------------
{
  const { repo, storage, writes } = makeRepo();
  const board = await createBoard(repo, 'Conflict board');
  const writesAfterCreate = writes.length;

  const conflict = repo.saveItem({
    boardId: board.boardId,
    lookId: 'look-1',
    sourceKind: 'LEGACY_UNVERSIONED',
    designVersionId: null,
    expectedRevision: board.revision + 5,
  });
  assert.equal(conflict.ok, false, 'wrong expectedRevision rejected');
  if (!conflict.ok) assert.equal(conflict.code, 'revision_conflict', 'revision_conflict code');
  assert.equal(writes.length, writesAfterCreate, 'revision conflict writes nothing');

  const saved = repo.saveItem({
    boardId: board.boardId,
    lookId: 'look-1',
    sourceKind: 'LEGACY_UNVERSIONED',
    designVersionId: null,
    expectedRevision: board.revision,
  });
  assert.equal(saved.ok && saved.value.changed === true, true, 'first save succeeds');
  if (!saved.ok) throw new Error('unreachable');
  const revAfterSave = saved.value.board.revision;
  assert.equal(writes.length, writesAfterCreate + 1, 'exactly one write for one successful command');

  const idempotent = repo.saveItem({
    boardId: board.boardId,
    lookId: 'look-1',
    sourceKind: 'LEGACY_UNVERSIONED',
    designVersionId: null,
    expectedRevision: revAfterSave,
  });
  assert.equal(idempotent.ok && idempotent.value.changed === false, true, 'idempotent save');
  assert.equal(writes.length, writesAfterCreate + 1, 'no-op save writes zero bytes');

  // reorder no-op: same position → zero writes
  const sameIndex = repo.reorderItem(board.boardId, saved.value.item.itemId, 0, revAfterSave);
  assert.equal(sameIndex.ok && sameIndex.value.changed === false, true, 'same-position reorder is a no-op');
  assert.equal(writes.length, writesAfterCreate + 1, 'no-op reorder writes zero bytes');

  // no shared references: mutating a returned board never corrupts the store
  const listed = repo.listBoards().boards[0];
  listed.title = 'MUTATED';
  listed.items.push({ itemId: 'evil', lookId: 'x', sourceKind: 'LEGACY_UNVERSIONED', designVersionId: null, savedAt: T0 });
  const reloaded = repo.listBoards().boards[0];
  assert.equal(reloaded.title, 'Conflict board', 'store not corrupted by caller mutation');
  assert.equal(reloaded.items.length, 1, 'item list not shared with caller');
}

// ---------------------------------------------------------------------------
// 6 · Atomic delete/reorder storage failure keeps previous canonical state
// ---------------------------------------------------------------------------
{
  const { repo, storage, writes } = makeRepo();
  const board = await createBoard(repo, 'Atomic board');
  const saved = repo.saveItem({
    boardId: board.boardId,
    lookId: 'look-1',
    sourceKind: 'LEGACY_UNVERSIONED',
    designVersionId: null,
    expectedRevision: board.revision,
  });
  if (!saved.ok) throw new Error('unreachable');
  const rev = saved.value.board.revision;
  const before = storage.read();

  // delete item with failing storage
  const broken = makeRepo();
  broken.repo.createBoard('Atomic board');
  const brokenBoard = broken.repo.listBoards().boards[0];
  const brokenSave = broken.repo.saveItem({
    boardId: brokenBoard.boardId,
    lookId: 'look-1',
    sourceKind: 'LEGACY_UNVERSIONED',
    designVersionId: null,
    expectedRevision: brokenBoard.revision,
  });
  if (!brokenSave.ok) throw new Error('unreachable');
  const brokenRev = brokenSave.value.board.revision;
  const storedBeforeFail = broken.storage.read();
  broken.setFailWrites(true);

  const deleteResult = broken.repo.deleteItem(brokenBoard.boardId, brokenSave.value.item.itemId, brokenRev);
  assert.equal(deleteResult.ok, false, 'delete with failing storage fails');
  if (!deleteResult.ok) assert.equal(deleteResult.code, 'persist_failed', 'persist_failed code');
  assert.equal(broken.storage.read(), storedBeforeFail, 'failed delete leaves storage byte-identical (no partial write)');

  const reorderResult = broken.repo.reorderItem(brokenBoard.boardId, brokenSave.value.item.itemId, 1, brokenRev);
  assert.equal(reorderResult.ok, false, 'reorder with failing storage fails');
  assert.equal(broken.storage.read(), storedBeforeFail, 'failed reorder leaves storage byte-identical');

  // canonical state preserved: previous write still parses and still has the item
  broken.setFailWrites(false);
  const reload = broken.repo.getBoard(brokenBoard.boardId);
  assert.equal(reload.board?.items.length, 1, 'previous canonical state preserved after failed delete');
  assert.equal(reload.board?.revision, brokenRev, 'revision unchanged after failures');

  // failure keeps previous UI state on the healthy repo too
  const after = storage.read();
  assert.equal(after, before, 'healthy repo storage unchanged when nothing failed');
  assert.equal(rev, saved.value.board.revision, 'revision stable');
}

// ---------------------------------------------------------------------------
// 7 · Crypto share token: raw token returned once, only hash persisted
// ---------------------------------------------------------------------------
{
  const { repo, storage } = makeRepo();
  const board = await createBoard(repo, 'Share board');
  const rev = board.revision;

  // PRIVATE boards are never shareable
  const privateShare = await repo.createShareLink(board.boardId);
  assert.equal(privateShare.ok, false, 'PRIVATE board share rejected');
  if (!privateShare.ok) assert.equal(privateShare.code, 'private_not_shareable', 'private_not_shareable code');

  // UNLISTED → share allowed
  const unlisted = repo.setVisibility(board.boardId, 'UNLISTED', false, rev);
  assert.equal(unlisted.ok, true, 'UNLISTED transition ok');
  const share = await repo.createShareLink(board.boardId);
  assert.equal(share.ok, true, 'UNLISTED share creation ok');
  if (!share.ok) throw new Error('unreachable');
  assert.equal(share.value.token.length >= 32, true, 'raw token is long and unguessable-shaped');
  assert.equal(/^[0-9a-f]{64}$/.test(share.value.share.tokenHash), true, 'persisted tokenHash is SHA-256 hex');

  const storedJson = storage.read();
  assert.ok(!storedJson.includes(share.value.token), 'raw token never persisted');
  assert.ok(storedJson.includes(share.value.share.tokenHash), 'tokenHash persisted');
  assert.equal(await webCryptoToken.hashToken(share.value.token), share.value.share.tokenHash, 'tokenHash matches SHA-256 of the raw token');

  // re-hashing the raw token resolves the same share (read-only share page path)
  const resolved = await repo.resolveAccessByToken(share.value.token);
  assert.equal(resolved.ok, true, 'token resolves');
  if (!resolved.ok) throw new Error('unreachable');
  assert.equal(resolved.value.access.access, 'viewer', 'anonymous token access is viewer');

  // storage contains no owner/customer/EditorDoc/manufacturing/device keys
  for (const forbidden of ['customerId', 'email', 'phone', 'editorDoc', 'recipeInstances', 'deviceTask', 'workOrder', 'manufacturingDefinition', 'rawToken']) {
    assert.ok(!storedJson.includes(forbidden), `stored envelope must not contain "${forbidden}"`);
  }

  // revoke: hash persists, revocation recorded, access flips to token_revoked
  const revoked = repo.revokeShare(board.boardId, share.value.share.shareId);
  assert.equal(revoked.ok, true, 'revoke ok');
  const afterRevoke = await repo.resolveAccessByToken(share.value.token);
  assert.equal(afterRevoke.ok, true, 'token still resolves to a share record');
  if (!afterRevoke.ok) throw new Error('unreachable');
  assert.equal(afterRevoke.value.access.access, 'token_revoked', 'revoked token access');

  // A future-expiring link may be revoked immediately without corrupting the
  // persisted store (regression: revokedAt was incorrectly compared to expiry).
  const { repo: expiringRepo } = makeRepo();
  const expiringBoard = await createBoard(expiringRepo, 'Expiring share');
  const expiringUnlisted = expiringRepo.setVisibility(
    expiringBoard.boardId,
    'UNLISTED',
    false,
    expiringBoard.revision,
  );
  assert.equal(expiringUnlisted.ok, true, 'expiring board becomes UNLISTED');
  const expiringShare = await expiringRepo.createShareLink(expiringBoard.boardId, {
    expiresAt: '2026-08-20T00:00:00.000Z',
  });
  assert.equal(expiringShare.ok, true, 'future-expiring share created');
  if (!expiringShare.ok) throw new Error('unreachable');
  assert.equal(
    expiringRepo.revokeShare(expiringBoard.boardId, expiringShare.value.share.shareId).ok,
    true,
    'future-expiring share revoked before expiry',
  );
  assert.equal(expiringRepo.listBoards().corrupted, false, 'early revoke leaves store parseable');

  // unknown token
  const unknown = await repo.resolveAccessByToken('definitely-not-a-real-token-xyz');
  assert.equal(unknown.ok, false, 'unknown token rejected');
  if (!unknown.ok) assert.equal(unknown.code, 'token_invalid', 'token_invalid code');
}

// Storage access failure is fail-closed, never treated as an empty writable store.
{
  const repo = new BoardRepository({
    storage: {
      read: () => { throw new Error('SecurityError'); },
      write: () => { throw new Error('must not write'); },
    },
    clock: { now: () => T0 },
    id: { nextId: () => 'id-never' },
    token: webCryptoToken,
    access: { getAccess: localDemoAccessProvider },
  });
  assert.equal(repo.listBoards().corrupted, true, 'storage read failure is disclosed as corrupted');
  const create = repo.createBoard('Must fail closed');
  assert.equal(create.ok, false, 'storage read failure blocks writes');
  if (!create.ok) assert.equal(create.code, 'storage_corrupted', 'fail-closed error code');
}

// ---------------------------------------------------------------------------
// 8 · Expiry / revoke / access matrix (pure resolver)
// ---------------------------------------------------------------------------
{
  const create = createBoardCommand({ boardId: 'b', ownerIdentityId: 'owner-1', title: 'B', now: T0 });
  if (!create.ok) throw new Error('unreachable');
  const privateState = create.state;
  const unlistedState = setVisibilityCommand(privateState, { visibility: 'UNLISTED', now: T0 });
  const publicState = setVisibilityCommand(privateState, { visibility: 'PUBLIC', publicConfirmed: true, now: T0 });
  if (!unlistedState.ok || !publicState.ok) throw new Error('unreachable');

  const share = createShareCommand(unlistedState.state, {
    shareId: 'share-1',
    tokenHash: 'b'.repeat(64),
    createdAt: T0,
    expiresAt: '2026-08-20T00:00:00.000Z',
  });
  if (!share.ok) throw new Error('unreachable');
  const unlistedWithShare = share.state;

  const HASH = 'b'.repeat(64);
  const LATER = '2026-09-01T00:00:00.000Z';
  const EXPIRED = '2026-08-21T00:00:00.000Z';

  const matrix = [
    // [visibility state, context, tokenHash, now, expected]
    [privateState, ownerContext('owner-1'), undefined, LATER, 'owner'],
    [privateState, anonymousContext(), undefined, LATER, 'unauthenticated'],
    [privateState, ownerContext('other-1'), undefined, LATER, 'forbidden'],
    [privateState, anonymousContext(), HASH, LATER, 'private_not_shareable'],
    [unlistedWithShare, ownerContext('owner-1'), undefined, LATER, 'owner'],
    [unlistedWithShare, anonymousContext(), HASH, T0, 'viewer'],
    [unlistedWithShare, anonymousContext(), undefined, LATER, 'unauthenticated'],
    [unlistedWithShare, ownerContext('other-1'), undefined, LATER, 'forbidden'],
    [unlistedWithShare, anonymousContext(), 'f'.repeat(64), LATER, 'token_invalid'],
    [unlistedWithShare, anonymousContext(), HASH, EXPIRED, 'token_expired'],
    [publicState.state, anonymousContext(), undefined, LATER, 'viewer'],
    [publicState.state, anonymousContext(), 'f'.repeat(64), LATER, 'viewer'],
  ];
  for (const [state, context, tokenHash, now, expected] of matrix) {
    const resolved = resolveBoardAccess(state.board, state.shares, context, tokenHash, now);
    assert.equal(resolved.access, expected, `access matrix: ${expected} (state=${state.board.visibility})`);
    if (resolved.access === 'viewer') {
      assert.equal(resolved.canEdit, false, 'anonymous viewers can never edit');
    }
    if (resolved.access === 'owner') {
      assert.equal(resolved.canEdit, true, 'owner can edit');
    }
  }

  // revoked token
  const revokedShare = revokeShareCommand(unlistedWithShare, { shareId: 'share-1', now: LATER });
  assert.equal(revokedShare.ok, true, 'revoke ok');
  if (!revokedShare.ok) throw new Error('unreachable');
  const revokedResolved = resolveBoardAccess(
    revokedShare.state.board,
    revokedShare.state.shares,
    anonymousContext(),
    HASH,
    LATER,
  );
  assert.equal(revokedResolved.access, 'token_revoked', 'revoked token access');
}

// ---------------------------------------------------------------------------
// 9 · Repository: visibility transition revokes active shares when → PRIVATE
// ---------------------------------------------------------------------------
{
  const { repo } = makeRepo();
  const board = await createBoard(repo, 'Private back');
  repo.setVisibility(board.boardId, 'UNLISTED', false, board.revision);
  const board2 = repo.getBoard(board.boardId).board;
  const share = await repo.createShareLink(board.boardId);
  assert.equal(share.ok, true, 'share created');
  if (!share.ok) throw new Error('unreachable');

  const back = repo.setVisibility(board.boardId, 'PRIVATE', false, board2.revision);
  assert.equal(back.ok, true, 'back to PRIVATE ok');
  if (!back.ok) throw new Error('unreachable');
  assert.equal(back.value.revokedShareCount, 1, 'active share revoked atomically');

  const after = await repo.resolveAccessByToken(share.value.token);
  assert.equal(after.ok, true, 'token still resolves to a share record');
  if (!after.ok) throw new Error('unreachable');
  assert.equal(after.value.access.access, 'private_not_shareable', 'PRIVATE board token access');
}

// ---------------------------------------------------------------------------
// 10 · Unavailable look / version view mapping
// ---------------------------------------------------------------------------
{
  const canonical = canonicalItem();
  const legacy = legacyItem();

  assert.deepEqual(resolveItemViewState(canonical, null), { state: 'look_unavailable' }, 'missing look → look_unavailable');
  assert.deepEqual(resolveItemViewState(legacy, null), { state: 'look_unavailable' }, 'legacy item with missing look → look_unavailable');

  assert.deepEqual(
    resolveItemViewState(legacy, { readModelKind: 'LEGACY_PARTIAL', designVersionId: undefined }),
    { state: 'available' },
    'legacy item + legacy look → available (inspiration reference)',
  );

  assert.deepEqual(
    resolveItemViewState(canonical, { readModelKind: 'CANONICAL', designVersionId: 'design-v-1' }),
    { state: 'available' },
    'canonical item + exact matching design version → available',
  );
  assert.deepEqual(
    resolveItemViewState(canonical, { readModelKind: 'CANONICAL', designVersionId: 'design-v-2' }),
    { state: 'version_unavailable' },
    'canonical item + mismatched design version → version_unavailable',
  );
  assert.deepEqual(
    resolveItemViewState(canonical, { readModelKind: 'LEGACY_PARTIAL', designVersionId: undefined }),
    { state: 'version_unavailable' },
    'canonical item + legacy look → version_unavailable',
  );
}

// ---------------------------------------------------------------------------
// 11 · Corrupted storage fails closed without throwing
// ---------------------------------------------------------------------------
{
  const corrupted = makeRepo();
  corrupted.storage.write('{not valid json!!');
  const { store, corrupted: flag } = corrupted.repo.readStore();
  assert.equal(flag, true, 'malformed JSON flagged corrupted');
  assert.deepEqual(store.boards, [], 'fail closed to empty store');

  const badSchema = makeRepo();
  badSchema.storage.write(JSON.stringify({ schemaVersion: 99, kind: 'NAIL_BOARD_STORE', boards: [], shares: [], updatedAt: T0 }));
  const parsed = badSchema.repo.readStore();
  assert.equal(parsed.corrupted, true, 'wrong schemaVersion flagged corrupted');

  // commands refuse to act on corrupted storage (no clobbering)
  const refused = badSchema.repo.createBoard('nope');
  assert.equal(refused.ok, false, 'create refused on corrupted storage');
  if (!refused.ok) assert.equal(refused.code, 'storage_corrupted', 'storage_corrupted code');
}

// ---------------------------------------------------------------------------
// 12 · Route / card / page wiring + package script + no forbidden copies
// ---------------------------------------------------------------------------
{
  assert.equal(Routes.communityBoards, '/community/boards', 'boards list route');
  assert.equal(Routes.communityBoardDetail('b-1'), '/community/board/b-1', 'board detail route');
  assert.equal(Routes.communityBoardShare('tok'), '/community/board/share/tok', 'share route carries only the token');

  const app = read('src/app/App.tsx');
  assert.match(app, /Routes\.communityBoards[\s\S]*CommunityBoardsPage/, 'boards route wired');
  assert.match(app, /Routes\.communityBoardDetailPath[\s\S]*CommunityBoardPage/, 'board detail route wired');
  assert.match(app, /Routes\.communityBoardSharePath[\s\S]*CommunityBoardSharePage/, 'share route wired');
  assert.match(
    app,
    /element=\{[^}]*CommunityLayout[^}]*\}[\s\S]*Routes\.communityBoards/,
    'boards routes nested inside the community shell',
  );

  const layout = read('src/app/layouts/CommunityLayout.tsx');
  assert.match(layout, /Routes\.communityBoards/, 'Boards nav entry');
  assert.match(layout, /text\('Nail Board', 'Nail Board'\)/, 'Boards nav label');

  const card = read('src/community/components/CommunityLookCard.tsx');
  assert.match(card, /onSave\?:/, 'card accepts onSave');
  assert.match(card, /disabled=\{!onSave\}/, 'Save enabled when onSave provided');
  assert.match(card, /onClick=\{\(\) => onSave\?\.\(look\)\}/, 'card reports save intent without persisting');
  assert.doesNotMatch(card, /localStorage|useToast|Date\.now/, 'card never fakes persistence');
  assert.doesNotMatch(card, /from ['\"]three/, 'no Three.js in card');

  const feed = read('src/community/components/CommunityFeed.tsx');
  assert.match(feed, /NailBoardSaveDialog/, 'feed owns the Save dialog');
  assert.match(feed, /onSave=\{\(selected\) => setSaveLook\(selected\)\}/, 'feed wires card save');
  assert.doesNotMatch(feed, /localStorage|useToast/, 'feed has no direct persistence/toast');

  const dialog = read('src/community/components/NailBoardSaveDialog.tsx');
  assert.match(dialog, /LEGACY_UNVERSIONED/, 'legacy looks save as unversioned reference');
  assert.match(dialog, /nail-board-legacy-caveat/, 'explicit legacy caveat');
  assert.match(dialog, /never fake|不伪造|已保存/, 'dialog shows honest saved state');
  assert.doesNotMatch(dialog, /from ['\"]three/, 'no Three.js in dialog');

  const boardsPage = read('src/community/pages/CommunityBoardsPage.tsx');
  assert.match(boardsPage, /boards-default-private-disclosure/, 'default PRIVATE disclosure');
  assert.match(boardsPage, /boards-empty/, 'empty state');
  assert.match(boardsPage, /boards-storage-corrupted/, 'corrupted storage disclosure');

  const boardPage = read('src/community/pages/CommunityBoardPage.tsx');
  assert.match(boardPage, /board-share-private-note/, 'PRIVATE not shareable note');
  assert.match(boardPage, /nail-board-public-confirm|NailBoardVisibilityControl/, 'PUBLIC confirmation via control');
  assert.match(boardPage, /board-item-move-up/, 'Move up control');
  assert.match(boardPage, /board-item-move-down/, 'Move down control');
  assert.match(boardPage, /board-item-delete/, 'Delete control');
  assert.match(boardPage, /board-item-look-unavailable/, 'unavailable item state');
  assert.match(boardPage, /board-item-version-unavailable/, 'version-unavailable item state');
  assert.doesNotMatch(boardPage, /from ['\"]three/, 'no Three.js in board page');

  const sharePage = read('src/community/pages/CommunityBoardSharePage.tsx');
  assert.match(sharePage, /resolveAccessByToken/, 'share page resolves by token');
  assert.match(sharePage, /share-readonly-disclosure/, 'read-only disclosure');
  assert.match(sharePage, /share-invalid/, 'invalid state');
  assert.match(sharePage, /share-expired/, 'expired state');
  assert.match(sharePage, /share-revoked/, 'revoked state');
  assert.match(sharePage, /share-private/, 'PRIVATE state');
  assert.doesNotMatch(sharePage, /rename|createShareLink|revokeShare|deleteItem/, 'share page exposes no owner actions');

  const routes = read('src/app/routes.ts');
  assert.doesNotMatch(routes, /communityBoardShare\(.*owner|communityBoardShare\(.*customer/, 'share URL never carries identity');

  const pkg = JSON.parse(read('package.json'));
  assert.ok(
    pkg.scripts['test:community-v7-1-nail-board']?.includes('test-community-v7-1-nail-board.mjs'),
    'package script registered',
  );

  // no EditorDoc / manufacturing / device copy anywhere in the board data path
  for (const file of [
    'src/community/domain/v7_1/nail-board.ts',
    'src/community/data/board-repository.ts',
  ]) {
    const source = read(file);
    for (const forbidden of ['editorDocRef', 'recipeInstances', 'deviceTask', 'workOrder', 'slotProfiles', 'waveform']) {
      assert.ok(!source.includes(forbidden), `${file} must not embed ${forbidden}`);
    }
  }
}

console.log('[test:community-v7-1-nail-board] PASS');
