/**
 * Community V7.1 · COMM-V7.1-03 Nail Board — domain contract (pure, dependency-free).
 *
 * Nail Board is a REFERENCE COLLECTION. It never copies an EditorDoc, customer /
 * private NailProfile, manufacturing definition, or device parameters. Items carry
 * exact references (lookId + designVersionId for canonical versioned content, or an
 * explicitly declared legacy-unversioned reference) — never content snapshots.
 *
 * This module is Node-testable (no browser globals, no environment access):
 *
 *  - Strict runtime parsers (`parseNailBoardV1` / `parseBoardShareLinkV1` /
 *    `parseNailBoardStoreV1`) never throw, never mutate input, reject unknown
 *    keys, bad timestamps/revision/visibility, duplicate items, reference
 *    mismatches, forbidden private keys and anything that is not part of the
 *    board contract (EditorDoc / manufacturing / device fields are unknown keys).
 *  - Pure commands (`createBoardCommand`, `saveItemCommand`, `deleteItemCommand`,
 *    `reorderItemCommand`, `renameBoardCommand`, `setVisibilityCommand`,
 *    `createShareCommand`, `revokeShareCommand`) never mutate their input and
 *    return fresh state; no-op commands return `changed: false` with the same
 *    reference so callers write zero bytes.
 *  - New boards are always PRIVATE. PUBLIC requires an explicit
 *    `publicConfirmed: true`. PRIVATE boards are never anonymously shareable.
 *  - Access resolution is deterministic: owner wins, UNLISTED requires a valid
 *    unexpired/unrevoked token, PUBLIC is readable by link but never editable by
 *    anonymous viewers, missing auth / forbidden / deleted states are explicit.
 *  - Share records store only a token HASH (SHA-256 hex), never the raw token,
 *    never a customer id, EditorDoc or manufacturing/device field.
 *
 * The repository (src/community/data/board-repository.ts) owns storage and the
 * expected-revision optimistic concurrency check; this module stays pure.
 */

import { MAX_ISSUES } from './contract';
import { scanForbiddenPrivateKeys } from './privacy';

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

export const NAIL_BOARD_VISIBILITIES = ['PRIVATE', 'UNLISTED', 'PUBLIC'] as const;
export type NailBoardVisibilityV1 = (typeof NAIL_BOARD_VISIBILITIES)[number];

export const BOARD_ITEM_SOURCE_KINDS = ['CANONICAL_VERSIONED', 'LEGACY_UNVERSIONED'] as const;
export type BoardItemSourceKindV1 = (typeof BOARD_ITEM_SOURCE_KINDS)[number];

export const NAIL_BOARD_SCHEMA_VERSION = 1 as const;
export const NAIL_BOARD_STORE_KIND = 'NAIL_BOARD_STORE' as const;

export const MAX_BOARD_TITLE_LENGTH = 80;
export const MAX_BOARD_ITEMS = 500;
export const MAX_SHARES_PER_BOARD = 50;

/** One item in an ordered board. References only; never a content copy. */
export interface BoardItemV1 {
  itemId: string;
  /** Canonical Community look id (legacy: contentId doubles as lookId). */
  lookId: string;
  sourceKind: BoardItemSourceKindV1;
  /**
   * CANONICAL_VERSIONED requires a non-null immutable DesignVersionV1 id.
   * LEGACY_UNVERSIONED requires exactly null: an explicitly declared
   * legacy-unversioned inspiration reference, never claimed version-stable.
   */
  designVersionId: string | null;
  /** When the item was saved to the board. */
  savedAt: string;
}

/** Reference collection (never a copy of design/manufacturing/device data). */
export interface NailBoardV1 {
  schemaVersion: 1;
  boardId: string;
  ownerIdentityId: string;
  title: string;
  visibility: NailBoardVisibilityV1;
  /** Ordered items; item ids are unique within the board. */
  items: BoardItemV1[];
  /** Positive revision, bumped on every mutating command (optimistic concurrency). */
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Optional share metadata. Only the SHA-256 token HASH is stored — the raw
 * token is returned exactly once by the repository for URL construction and is
 * never persisted. No owner/customer identity is stored here.
 */
export interface BoardShareLinkV1 {
  schemaVersion: 1;
  shareId: string;
  boardId: string;
  /** SHA-256 hex of the unguessable raw token. */
  tokenHash: string;
  createdAt: string;
  /** Optional absolute expiry (ISO). Expired tokens are rejected. */
  expiresAt?: string;
  /** Set when revoked; revoked tokens are rejected. */
  revokedAt?: string;
}

/** Versioned local storage envelope (one atomic write per successful command). */
export interface NailBoardStoreV1 {
  schemaVersion: 1;
  kind: 'NAIL_BOARD_STORE';
  boards: NailBoardV1[];
  shares: BoardShareLinkV1[];
  updatedAt: string;
}

/**
 * Typed access context. This repo has no real auth/backend: the UI injects a
 * disclosed local-demo identity; the share route injects the anonymous context.
 * `disclosure` makes the prototype nature explicit ('local_demo' | 'none').
 */
export interface BoardAccessContextV1 {
  authenticated: boolean;
  identityId?: string;
  disclosure: 'local_demo' | 'none';
  note?: string;
}

export type BoardAccessResolutionV1 =
  | { access: 'owner'; canEdit: true }
  | { access: 'viewer'; canEdit: false; via: 'unlisted_token' | 'public_link' }
  | { access: 'unauthenticated' }
  | { access: 'forbidden' }
  | { access: 'private_not_shareable' }
  | { access: 'token_invalid' }
  | { access: 'token_expired' }
  | { access: 'token_revoked' };

// ---------------------------------------------------------------------------
// Parsers (never throw, never mutate, bounded issues)
// ---------------------------------------------------------------------------

export type NailBoardIssueCode =
  | 'not_an_object'
  | 'schema_version'
  | 'unknown_key'
  | 'missing_field'
  | 'invalid_type'
  | 'invalid_enum'
  | 'empty_string'
  | 'invalid_id'
  | 'invalid_timestamp'
  | 'invalid_revision'
  | 'duplicate_item'
  | 'duplicate_board'
  | 'duplicate_share'
  | 'share_board_missing'
  | 'reference_mismatch'
  | 'forbidden_private_key'
  | 'invalid_token_hash'
  | 'too_many_items'
  | 'too_many_shares';

export interface NailBoardIssue {
  code: NailBoardIssueCode;
  path: string;
  message: string;
}

export type NailBoardParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; issues: NailBoardIssue[] };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

const NAIL_BOARD_ALLOWED_KEYS = [
  'schemaVersion',
  'boardId',
  'ownerIdentityId',
  'title',
  'visibility',
  'items',
  'revision',
  'createdAt',
  'updatedAt',
] as const;

const BOARD_ITEM_ALLOWED_KEYS = [
  'itemId',
  'lookId',
  'sourceKind',
  'designVersionId',
  'savedAt',
] as const;

const BOARD_SHARE_ALLOWED_KEYS = [
  'schemaVersion',
  'shareId',
  'boardId',
  'tokenHash',
  'createdAt',
  'expiresAt',
  'revokedAt',
] as const;

const NAIL_BOARD_STORE_ALLOWED_KEYS = [
  'schemaVersion',
  'kind',
  'boards',
  'shares',
  'updatedAt',
] as const;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  return type === 'object' ? 'object' : type;
}

function addIssue(
  issues: NailBoardIssue[],
  code: NailBoardIssueCode,
  path: string,
  message: string,
): void {
  if (issues.length < MAX_ISSUES) issues.push({ code, path, message });
}

function fail(
  issues: NailBoardIssue[],
  code: NailBoardIssueCode,
  path: string,
  message: string,
): NailBoardParseResult<never> {
  addIssue(issues, code, path, message);
  return { ok: false, reason: message, issues };
}

function checkSchemaVersion(raw: UnknownRecord, path: string, issues: NailBoardIssue[]): void {
  const value = raw['schemaVersion'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.schemaVersion`, 'missing required field "schemaVersion"');
  } else if (value !== NAIL_BOARD_SCHEMA_VERSION) {
    addIssue(issues, 'schema_version', `${path}.schemaVersion`, `expected schemaVersion ${NAIL_BOARD_SCHEMA_VERSION}, got ${String(value)}`);
  }
}

function checkKeys(
  raw: UnknownRecord,
  allowedKeys: readonly string[],
  path: string,
  issues: NailBoardIssue[],
): void {
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.includes(key)) {
      addIssue(issues, 'unknown_key', `${path}.${key}`, `unknown key "${key}" is not part of the Nail Board contract (no EditorDoc / manufacturing / device / private data)`);
    }
  }
}

function readRequiredString(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: NailBoardIssue[],
): string | undefined {
  const value = raw[key];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.${key}`, `missing required field "${key}"`);
    return undefined;
  }
  if (typeof value !== 'string') {
    addIssue(issues, 'invalid_type', `${path}.${key}`, `expected string, got ${describe(value)}`);
    return undefined;
  }
  if (value.trim().length === 0) {
    addIssue(issues, 'empty_string', `${path}.${key}`, `"${key}" must not be empty`);
    return undefined;
  }
  return value;
}

function readOptionalString(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: NailBoardIssue[],
): string | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    addIssue(issues, 'invalid_type', `${path}.${key}`, `expected string, got ${describe(value)}`);
    return undefined;
  }
  if (value.trim().length === 0) {
    addIssue(issues, 'empty_string', `${path}.${key}`, `"${key}" must not be empty`);
    return undefined;
  }
  return value;
}

function checkTimestamp(value: unknown, path: string, issues: NailBoardIssue[]): boolean {
  if (typeof value !== 'string') {
    addIssue(issues, 'invalid_type', path, `expected ISO timestamp string, got ${describe(value)}`);
    return false;
  }
  if (!ISO_PATTERN.test(value)) {
    addIssue(issues, 'invalid_timestamp', path, `"${value}" is not a valid ISO-8601 UTC timestamp`);
    return false;
  }
  return true;
}

function parseBoardItem(rawValue: unknown, path: string, issues: NailBoardIssue[]): BoardItemV1 | null {
  const issueStart = issues.length;
  const raw = record(rawValue);
  if (!raw) {
    addIssue(issues, 'invalid_type', path, 'board item must be a plain object');
    return null;
  }
  checkKeys(raw, BOARD_ITEM_ALLOWED_KEYS, path, issues);

  const itemId = readRequiredString(raw, 'itemId', path, issues);
  const lookId = readRequiredString(raw, 'lookId', path, issues);
  const savedAt = readRequiredString(raw, 'savedAt', path, issues);
  if (savedAt !== undefined) checkTimestamp(savedAt, `${path}.savedAt`, issues);

  const sourceKindValue = raw['sourceKind'];
  if (sourceKindValue === undefined) {
    addIssue(issues, 'missing_field', `${path}.sourceKind`, 'missing required field "sourceKind"');
  } else if (typeof sourceKindValue !== 'string' || !BOARD_ITEM_SOURCE_KINDS.includes(sourceKindValue as BoardItemSourceKindV1)) {
    addIssue(issues, 'invalid_enum', `${path}.sourceKind`, `invalid sourceKind "${String(sourceKindValue)}"`);
  }

  const designVersionValue = raw['designVersionId'];
  if (designVersionValue === undefined) {
    addIssue(issues, 'missing_field', `${path}.designVersionId`, 'missing required field "designVersionId"');
  } else if (designVersionValue !== null && typeof designVersionValue !== 'string') {
    addIssue(issues, 'invalid_type', `${path}.designVersionId`, 'expected string or null');
  }

  // Reference mismatch: canonical requires non-null designVersionId; legacy requires null.
  if (sourceKindValue === 'CANONICAL_VERSIONED') {
    if (typeof designVersionValue !== 'string' || designVersionValue.trim().length === 0) {
      addIssue(issues, 'reference_mismatch', `${path}.designVersionId`, 'CANONICAL_VERSIONED item requires a non-null designVersionId');
    }
  } else if (sourceKindValue === 'LEGACY_UNVERSIONED') {
    if (designVersionValue !== null) {
      addIssue(issues, 'reference_mismatch', `${path}.designVersionId`, 'LEGACY_UNVERSIONED item must carry designVersionId: null (explicit legacy-unversioned reference)');
    }
  }

  if (itemId !== undefined && !ID_PATTERN.test(itemId)) {
    addIssue(issues, 'invalid_id', `${path}.itemId`, `"${itemId}" is not a valid item id`);
  }
  if (lookId !== undefined && !ID_PATTERN.test(lookId)) {
    addIssue(issues, 'invalid_id', `${path}.lookId`, `"${lookId}" is not a valid look id`);
  }

  // Any issue raised while parsing this item makes the item invalid. Use the
  // issue-count delta (not path prefixing) so `$.items[1]` can never swallow
  // issues belonging to `$.items[10]`.
  if (issues.length > issueStart) return null;

  return {
    itemId: itemId as string,
    lookId: lookId as string,
    sourceKind: sourceKindValue as BoardItemSourceKindV1,
    designVersionId: designVersionValue as string | null,
    savedAt: savedAt as string,
  };
}

/**
 * Strict runtime parse of one NailBoardV1. Rejects unknown keys (including any
 * EditorDoc / manufacturing / device / private data key), malformed
 * ids/timestamps/revision/visibility, duplicate items, duplicate dedupe keys
 * (same sourceKind + lookId + exact designVersionId) and forbidden private keys
 * at any depth. Never throws; never mutates the input.
 */
export function parseNailBoardV1(input: unknown): NailBoardParseResult<NailBoardV1> {
  const issues: NailBoardIssue[] = [];
  const raw = record(input);
  if (!raw) return fail(issues, 'not_an_object', '$', 'board must be a plain object');

  checkSchemaVersion(raw, '$', issues);
  checkKeys(raw, NAIL_BOARD_ALLOWED_KEYS, '$', issues);

  const boardId = readRequiredString(raw, 'boardId', '$', issues);
  const ownerIdentityId = readRequiredString(raw, 'ownerIdentityId', '$', issues);
  const title = readRequiredString(raw, 'title', '$', issues);
  const createdAt = readRequiredString(raw, 'createdAt', '$', issues);
  const updatedAt = readRequiredString(raw, 'updatedAt', '$', issues);

  if (boardId !== undefined && !ID_PATTERN.test(boardId)) {
    addIssue(issues, 'invalid_id', '$.boardId', `"${boardId}" is not a valid board id`);
  }
  if (ownerIdentityId !== undefined && !ID_PATTERN.test(ownerIdentityId)) {
    addIssue(issues, 'invalid_id', '$.ownerIdentityId', `"${ownerIdentityId}" is not a valid identity id`);
  }
  if (title !== undefined && title.trim().length > MAX_BOARD_TITLE_LENGTH) {
    addIssue(issues, 'invalid_type', '$.title', `title exceeds ${MAX_BOARD_TITLE_LENGTH} characters`);
  }
  if (createdAt !== undefined) checkTimestamp(createdAt, '$.createdAt', issues);
  if (updatedAt !== undefined) checkTimestamp(updatedAt, '$.updatedAt', issues);

  const visibilityValue = raw['visibility'];
  if (visibilityValue === undefined) {
    addIssue(issues, 'missing_field', '$.visibility', 'missing required field "visibility"');
  } else if (typeof visibilityValue !== 'string' || !NAIL_BOARD_VISIBILITIES.includes(visibilityValue as NailBoardVisibilityV1)) {
    addIssue(issues, 'invalid_enum', '$.visibility', `invalid visibility "${String(visibilityValue)}"`);
  }

  const revisionValue = raw['revision'];
  if (revisionValue === undefined) {
    addIssue(issues, 'missing_field', '$.revision', 'missing required field "revision"');
  } else if (typeof revisionValue !== 'number' || !Number.isInteger(revisionValue) || revisionValue < 1) {
    addIssue(issues, 'invalid_revision', '$.revision', `revision must be a positive integer, got ${String(revisionValue)}`);
  }

  let items: BoardItemV1[] = [];
  const itemsValue = raw['items'];
  if (itemsValue === undefined) {
    addIssue(issues, 'missing_field', '$.items', 'missing required field "items"');
  } else if (!Array.isArray(itemsValue)) {
    addIssue(issues, 'invalid_type', '$.items', 'items must be an array');
  } else {
    if (itemsValue.length > MAX_BOARD_ITEMS) {
      addIssue(issues, 'too_many_items', '$.items', `board exceeds ${MAX_BOARD_ITEMS} items`);
    }
    const seenItemIds = new Set<string>();
    const seenDedupeKeys = new Set<string>();
    for (let i = 0; i < itemsValue.length; i += 1) {
      const itemPath = `$.items[${i}]`;
      const item = parseBoardItem(itemsValue[i], itemPath, issues);
      if (item === null) continue;
      if (seenItemIds.has(item.itemId)) {
        addIssue(issues, 'duplicate_item', `${itemPath}.itemId`, `duplicate itemId "${item.itemId}"`);
        continue;
      }
      seenItemIds.add(item.itemId);
      const dedupeKey = boardItemDedupeKey(item);
      if (seenDedupeKeys.has(dedupeKey)) {
        addIssue(issues, 'duplicate_item', itemPath, `duplicate reference (sourceKind + lookId + designVersionId) "${dedupeKey}"`);
        continue;
      }
      seenDedupeKeys.add(dedupeKey);
      items.push(item);
    }
  }

  // Forbidden private keys (customer PKs, geometry, notes, contacts, credentials)
  // at any depth are rejected, not silently stripped.
  const privacyIssues: Array<{ path: string; message: string }> = [];
  scanForbiddenPrivateKeys(raw, '$', privacyIssues as unknown as NailBoardIssue[]);
  for (const issue of privacyIssues) {
    addIssue(issues, 'forbidden_private_key', issue.path, issue.message);
  }

  if (issues.length > 0) {
    return { ok: false, reason: issues[0]?.message ?? 'invalid board', issues };
  }

  const board: NailBoardV1 = {
    schemaVersion: NAIL_BOARD_SCHEMA_VERSION,
    boardId: boardId as string,
    ownerIdentityId: ownerIdentityId as string,
    title: (title as string).trim(),
    visibility: visibilityValue as NailBoardVisibilityV1,
    items,
    revision: revisionValue as number,
    createdAt: createdAt as string,
    updatedAt: updatedAt as string,
  };
  return { ok: true, value: board };
}

/**
 * Strict runtime parse of one BoardShareLinkV1. Rejects unknown keys, bad
 * token hashes (must be 64-char lowercase SHA-256 hex), bad timestamps and
 * missing board references. Never throws; never mutates the input.
 */
export function parseBoardShareLinkV1(input: unknown): NailBoardParseResult<BoardShareLinkV1> {
  const issues: NailBoardIssue[] = [];
  const raw = record(input);
  if (!raw) return fail(issues, 'not_an_object', '$', 'share record must be a plain object');

  checkSchemaVersion(raw, '$', issues);
  checkKeys(raw, BOARD_SHARE_ALLOWED_KEYS, '$', issues);

  const shareId = readRequiredString(raw, 'shareId', '$', issues);
  const boardId = readRequiredString(raw, 'boardId', '$', issues);
  const tokenHash = readRequiredString(raw, 'tokenHash', '$', issues);
  const createdAt = readRequiredString(raw, 'createdAt', '$', issues);
  const expiresAt = readOptionalString(raw, 'expiresAt', '$', issues);
  const revokedAt = readOptionalString(raw, 'revokedAt', '$', issues);

  if (shareId !== undefined && !ID_PATTERN.test(shareId)) {
    addIssue(issues, 'invalid_id', '$.shareId', `"${shareId}" is not a valid share id`);
  }
  if (boardId !== undefined && !ID_PATTERN.test(boardId)) {
    addIssue(issues, 'invalid_id', '$.boardId', `"${boardId}" is not a valid board id`);
  }
  if (tokenHash !== undefined && !SHA256_HEX_PATTERN.test(tokenHash)) {
    addIssue(issues, 'invalid_token_hash', '$.tokenHash', 'tokenHash must be 64 lowercase hex chars (SHA-256 of the share token)');
  }
  if (createdAt !== undefined) checkTimestamp(createdAt, '$.createdAt', issues);
  if (expiresAt !== undefined) checkTimestamp(expiresAt, '$.expiresAt', issues);
  if (revokedAt !== undefined) checkTimestamp(revokedAt, '$.revokedAt', issues);
  if (expiresAt !== undefined && createdAt !== undefined && expiresAt <= createdAt) {
    addIssue(issues, 'invalid_timestamp', '$.expiresAt', 'expiresAt must be after createdAt');
  }
  if (revokedAt !== undefined && createdAt !== undefined && revokedAt < createdAt) {
    addIssue(issues, 'invalid_timestamp', '$.revokedAt', 'revokedAt must not precede createdAt');
  }

  if (issues.length > 0) return { ok: false, reason: issues[0]?.message ?? 'invalid share record', issues };
  return {
    ok: true,
    value: {
      schemaVersion: NAIL_BOARD_SCHEMA_VERSION,
      shareId: shareId as string,
      boardId: boardId as string,
      tokenHash: tokenHash as string,
      createdAt: createdAt as string,
      expiresAt,
      revokedAt,
    },
  };
}

/**
 * Strict runtime parse of the versioned storage envelope. Rejects unknown keys,
 * duplicate board/share ids, shares whose board is missing, and any malformed
 * board or share record. Never throws; never mutates the input.
 */
export function parseNailBoardStoreV1(input: unknown): NailBoardParseResult<NailBoardStoreV1> {
  const issues: NailBoardIssue[] = [];
  const raw = record(input);
  if (!raw) return fail(issues, 'not_an_object', '$', 'store must be a plain object');

  checkSchemaVersion(raw, '$', issues);
  checkKeys(raw, NAIL_BOARD_STORE_ALLOWED_KEYS, '$', issues);

  if (raw['kind'] === undefined) {
    addIssue(issues, 'missing_field', '$.kind', 'missing required field "kind"');
  } else if (raw['kind'] !== NAIL_BOARD_STORE_KIND) {
    addIssue(issues, 'invalid_enum', '$.kind', `expected kind "${NAIL_BOARD_STORE_KIND}", got ${String(raw['kind'])}`);
  }

  const updatedAt = readRequiredString(raw, 'updatedAt', '$', issues);
  if (updatedAt !== undefined) checkTimestamp(updatedAt, '$.updatedAt', issues);

  const boards: NailBoardV1[] = [];
  const boardsValue = raw['boards'];
  if (boardsValue === undefined) {
    addIssue(issues, 'missing_field', '$.boards', 'missing required field "boards"');
  } else if (!Array.isArray(boardsValue)) {
    addIssue(issues, 'invalid_type', '$.boards', 'boards must be an array');
  } else {
    const seenBoardIds = new Set<string>();
    for (let i = 0; i < boardsValue.length; i += 1) {
      const result = parseNailBoardV1(boardsValue[i]);
      if (!result.ok) {
        for (const issue of result.issues) {
          addIssue(issues, issue.code, `$.boards[${i}]${issue.path.slice(1)}`, issue.message);
        }
        continue;
      }
      if (seenBoardIds.has(result.value.boardId)) {
        addIssue(issues, 'duplicate_board', `$.boards[${i}].boardId`, `duplicate boardId "${result.value.boardId}"`);
        continue;
      }
      seenBoardIds.add(result.value.boardId);
      boards.push(result.value);
    }
  }

  const shares: BoardShareLinkV1[] = [];
  const sharesValue = raw['shares'];
  if (sharesValue === undefined) {
    addIssue(issues, 'missing_field', '$.shares', 'missing required field "shares"');
  } else if (!Array.isArray(sharesValue)) {
    addIssue(issues, 'invalid_type', '$.shares', 'shares must be an array');
  } else {
    const boardIds = new Set(boards.map((board) => board.boardId));
    const seenShareIds = new Set<string>();
    for (let i = 0; i < sharesValue.length; i += 1) {
      const result = parseBoardShareLinkV1(sharesValue[i]);
      if (!result.ok) {
        for (const issue of result.issues) {
          addIssue(issues, issue.code, `$.shares[${i}]${issue.path.slice(1)}`, issue.message);
        }
        continue;
      }
      if (seenShareIds.has(result.value.shareId)) {
        addIssue(issues, 'duplicate_share', `$.shares[${i}].shareId`, `duplicate shareId "${result.value.shareId}"`);
        continue;
      }
      if (!boardIds.has(result.value.boardId)) {
        addIssue(issues, 'share_board_missing', `$.shares[${i}].boardId`, `share references missing board "${result.value.boardId}"`);
        continue;
      }
      seenShareIds.add(result.value.shareId);
      shares.push(result.value);
    }
  }

  if (issues.length > 0) return { ok: false, reason: issues[0]?.message ?? 'invalid store', issues };
  return {
    ok: true,
    value: {
      schemaVersion: NAIL_BOARD_SCHEMA_VERSION,
      kind: NAIL_BOARD_STORE_KIND,
      boards,
      shares,
      updatedAt: updatedAt as string,
    },
  };
}

// ---------------------------------------------------------------------------
// Pure commands
// ---------------------------------------------------------------------------

export interface BoardStateV1 {
  board: NailBoardV1;
  shares: BoardShareLinkV1[];
}

export type BoardCommandErrorCode =
  | 'invalid_input'
  | 'board_not_found'
  | 'item_not_found'
  | 'duplicate_item'
  | 'revision_conflict'
  | 'public_not_confirmed'
  | 'private_not_shareable'
  | 'share_not_found'
  | 'forbidden'
  | 'unauthenticated';

export type BoardCommandResult =
  | { ok: true; changed: boolean; state: BoardStateV1 }
  | { ok: false; code: BoardCommandErrorCode; message: string };

function err(code: BoardCommandErrorCode, message: string): BoardCommandResult {
  return { ok: false, code, message };
}

function isIsoTimestamp(value: string): boolean {
  return ISO_PATTERN.test(value);
}

function isNonEmptyId(value: string): boolean {
  return ID_PATTERN.test(value);
}

function bumpRevision(board: NailBoardV1, now: string): NailBoardV1 {
  return {
    ...board,
    revision: board.revision + 1,
    updatedAt: now,
    items: board.items.map((item) => ({ ...item })),
  };
}

/**
 * Create a board. Always PRIVATE, revision 1, empty items. The input title is
 * trimmed; the returned board never shares references with the input.
 */
export function createBoardCommand(input: {
  boardId: string;
  ownerIdentityId: string;
  title: string;
  now: string;
}): BoardCommandResult {
  const title = input.title.trim();
  if (!isNonEmptyId(input.boardId) || !isNonEmptyId(input.ownerIdentityId)) {
    return err('invalid_input', 'boardId and ownerIdentityId must be valid ids');
  }
  if (title.length === 0 || title.length > MAX_BOARD_TITLE_LENGTH) {
    return err('invalid_input', `title must be 1..${MAX_BOARD_TITLE_LENGTH} characters`);
  }
  if (!isIsoTimestamp(input.now)) {
    return err('invalid_input', 'now must be an ISO timestamp');
  }
  const board: NailBoardV1 = {
    schemaVersion: NAIL_BOARD_SCHEMA_VERSION,
    boardId: input.boardId,
    ownerIdentityId: input.ownerIdentityId,
    title,
    visibility: 'PRIVATE',
    items: [],
    revision: 1,
    createdAt: input.now,
    updatedAt: input.now,
  };
  return { ok: true, changed: true, state: { board, shares: [] } };
}

export interface SaveItemInputV1 {
  itemId: string;
  lookId: string;
  sourceKind: BoardItemSourceKindV1;
  designVersionId: string | null;
  /** When the user saved the item. */
  savedAt: string;
  /** Board mutation time. */
  now: string;
}

/**
 * Idempotent save: an existing item with the same dedupe key (sourceKind +
 * lookId + exact designVersionId) makes this a no-op (`changed: false`, same
 * state reference). Canonical items require a non-null designVersionId; legacy
 * items require exactly null. Never mutates the input state.
 */
export function saveItemCommand(state: BoardStateV1, input: SaveItemInputV1): BoardCommandResult {
  const { board } = state;
  if (!isNonEmptyId(input.itemId) || !isNonEmptyId(input.lookId)) {
    return err('invalid_input', 'itemId and lookId must be valid ids');
  }
  if (!BOARD_ITEM_SOURCE_KINDS.includes(input.sourceKind)) {
    return err('invalid_input', `invalid sourceKind "${String(input.sourceKind)}"`);
  }
  if (input.sourceKind === 'CANONICAL_VERSIONED') {
    if (typeof input.designVersionId !== 'string' || input.designVersionId.trim().length === 0) {
      return err('invalid_input', 'CANONICAL_VERSIONED item requires a non-null designVersionId');
    }
  } else if (input.designVersionId !== null) {
    return err('invalid_input', 'LEGACY_UNVERSIONED item must carry designVersionId: null');
  }
  if (!isIsoTimestamp(input.savedAt) || !isIsoTimestamp(input.now)) {
    return err('invalid_input', 'savedAt and now must be ISO timestamps');
  }
  if (board.items.length >= MAX_BOARD_ITEMS) {
    return err('invalid_input', `board already has ${MAX_BOARD_ITEMS} items`);
  }

  const dedupeKey = boardItemDedupeKey({
    sourceKind: input.sourceKind,
    lookId: input.lookId,
    designVersionId: input.designVersionId,
  });
  const existing = board.items.find((item) => boardItemDedupeKey(item) === dedupeKey);
  if (existing) {
    // Idempotent: already saved, nothing to write.
    return { ok: true, changed: false, state };
  }
  if (board.items.some((item) => item.itemId === input.itemId)) {
    return err('duplicate_item', `itemId "${input.itemId}" already exists in this board`);
  }

  const item: BoardItemV1 = {
    itemId: input.itemId,
    lookId: input.lookId,
    sourceKind: input.sourceKind,
    designVersionId: input.designVersionId,
    savedAt: input.savedAt,
  };
  const next = bumpRevision(board, input.now);
  next.items = [...next.items, item];
  return { ok: true, changed: true, state: { board: next, shares: state.shares } };
}

export function deleteItemCommand(
  state: BoardStateV1,
  input: { itemId: string; now: string },
): BoardCommandResult {
  const { board } = state;
  if (!isIsoTimestamp(input.now)) return err('invalid_input', 'now must be an ISO timestamp');
  const index = board.items.findIndex((item) => item.itemId === input.itemId);
  if (index === -1) return err('item_not_found', `item "${input.itemId}" not found`);
  const next = bumpRevision(board, input.now);
  next.items = next.items.filter((item) => item.itemId !== input.itemId);
  return { ok: true, changed: true, state: { board: next, shares: state.shares } };
}

export function reorderItemCommand(
  state: BoardStateV1,
  input: { itemId: string; toIndex: number; now: string },
): BoardCommandResult {
  const { board } = state;
  if (!isIsoTimestamp(input.now)) return err('invalid_input', 'now must be an ISO timestamp');
  if (!Number.isInteger(input.toIndex) || input.toIndex < 0 || input.toIndex >= board.items.length) {
    return err('invalid_input', `toIndex must be an integer in 0..${Math.max(0, board.items.length - 1)}`);
  }
  const fromIndex = board.items.findIndex((item) => item.itemId === input.itemId);
  if (fromIndex === -1) return err('item_not_found', `item "${input.itemId}" not found`);
  if (fromIndex === input.toIndex) {
    // No-op: same position, zero writes.
    return { ok: true, changed: false, state };
  }
  const items = board.items.map((item) => ({ ...item }));
  const [moved] = items.splice(fromIndex, 1);
  items.splice(input.toIndex, 0, moved);
  const next = bumpRevision(board, input.now);
  next.items = items;
  return { ok: true, changed: true, state: { board: next, shares: state.shares } };
}

export function renameBoardCommand(
  state: BoardStateV1,
  input: { title: string; now: string },
): BoardCommandResult {
  const { board } = state;
  const title = input.title.trim();
  if (title.length === 0 || title.length > MAX_BOARD_TITLE_LENGTH) {
    return err('invalid_input', `title must be 1..${MAX_BOARD_TITLE_LENGTH} characters`);
  }
  if (!isIsoTimestamp(input.now)) return err('invalid_input', 'now must be an ISO timestamp');
  if (board.title === title) {
    return { ok: true, changed: false, state };
  }
  const next = bumpRevision(board, input.now);
  next.title = title;
  return { ok: true, changed: true, state: { board: next, shares: state.shares } };
}

/**
 * Visibility transition. PUBLIC requires an explicit `publicConfirmed: true`;
 * without it the command fails with `public_not_confirmed` and writes nothing.
 * UNLISTED is a share-link-only visibility (not publicly indexed). PRIVATE is
 * never anonymously shareable (the repository also revokes active share links
 * when a board returns to PRIVATE).
 */
export function setVisibilityCommand(
  state: BoardStateV1,
  input: { visibility: NailBoardVisibilityV1; publicConfirmed?: boolean; now: string },
): BoardCommandResult {
  const { board } = state;
  if (!NAIL_BOARD_VISIBILITIES.includes(input.visibility)) {
    return err('invalid_input', `invalid visibility "${String(input.visibility)}"`);
  }
  if (!isIsoTimestamp(input.now)) return err('invalid_input', 'now must be an ISO timestamp');
  if (board.visibility === input.visibility) {
    return { ok: true, changed: false, state };
  }
  if (input.visibility === 'PUBLIC' && input.publicConfirmed !== true) {
    return err('public_not_confirmed', 'transition to PUBLIC requires explicit publicConfirmed: true');
  }
  const next = bumpRevision(board, input.now);
  next.visibility = input.visibility;
  return { ok: true, changed: true, state: { board: next, shares: state.shares } };
}

export interface CreateShareInputV1 {
  shareId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * Create share metadata. PRIVATE boards are never anonymously shareable
 * (`private_not_shareable`). Only the token hash is stored; the raw token is
 * the repository's one-time return value and never enters this module.
 * Idempotent on tokenHash.
 */
export function createShareCommand(state: BoardStateV1, input: CreateShareInputV1): BoardCommandResult {
  const { board, shares } = state;
  if (board.visibility === 'PRIVATE') {
    return err('private_not_shareable', 'PRIVATE boards are never anonymously shareable');
  }
  if (!isNonEmptyId(input.shareId)) return err('invalid_input', 'shareId must be a valid id');
  if (!SHA256_HEX_PATTERN.test(input.tokenHash)) {
    return err('invalid_input', 'tokenHash must be a 64-char lowercase SHA-256 hex');
  }
  if (!isIsoTimestamp(input.createdAt)) return err('invalid_input', 'createdAt must be an ISO timestamp');
  if (input.expiresAt !== undefined && !isIsoTimestamp(input.expiresAt)) {
    return err('invalid_input', 'expiresAt must be an ISO timestamp');
  }
  if (input.expiresAt !== undefined && input.expiresAt <= input.createdAt) {
    return err('invalid_input', 'expiresAt must be after createdAt');
  }
  if (shares.length >= MAX_SHARES_PER_BOARD) {
    return err('invalid_input', `board already has ${MAX_SHARES_PER_BOARD} share records`);
  }
  const existing = shares.find((share) => share.tokenHash === input.tokenHash);
  if (existing) {
    return { ok: true, changed: false, state };
  }
  const share: BoardShareLinkV1 = {
    schemaVersion: NAIL_BOARD_SCHEMA_VERSION,
    shareId: input.shareId,
    boardId: board.boardId,
    tokenHash: input.tokenHash,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  };
  return { ok: true, changed: true, state: { board, shares: [...shares, share] } };
}

export function revokeShareCommand(
  state: BoardStateV1,
  input: { shareId: string; now: string },
): BoardCommandResult {
  const { board, shares } = state;
  if (!isIsoTimestamp(input.now)) return err('invalid_input', 'now must be an ISO timestamp');
  const index = shares.findIndex((share) => share.shareId === input.shareId);
  if (index === -1) return err('share_not_found', `share "${input.shareId}" not found`);
  if (shares[index].revokedAt) {
    return { ok: true, changed: false, state };
  }
  const nextShares = shares.map((share) => ({ ...share }));
  nextShares[index] = { ...nextShares[index], revokedAt: input.now };
  return { ok: true, changed: true, state: { board, shares: nextShares } };
}

// ---------------------------------------------------------------------------
// Access resolution
// ---------------------------------------------------------------------------

/**
 * Deterministic access resolution. `tokenHash` is the SHA-256 hash of the raw
 * share token — this module never sees raw tokens. Rules:
 *  - owner identity → owner (can edit);
 *  - PRIVATE → never shareable with a token; anonymous → unauthenticated,
 *    other authenticated identity → forbidden;
 *  - UNLISTED → token required; unknown/mismatched → token_invalid,
 *    revoked → token_revoked, expired → token_expired, valid → viewer;
 *  - PUBLIC → readable by link (viewer, never editable); token is irrelevant.
 */
export function resolveBoardAccess(
  board: NailBoardV1,
  shares: BoardShareLinkV1[],
  context: BoardAccessContextV1,
  tokenHash: string | undefined,
  now: string,
): BoardAccessResolutionV1 {
  if (context.authenticated && context.identityId === board.ownerIdentityId) {
    return { access: 'owner', canEdit: true };
  }
  if (board.visibility === 'PRIVATE') {
    if (tokenHash) return { access: 'private_not_shareable' };
    return context.authenticated ? { access: 'forbidden' } : { access: 'unauthenticated' };
  }
  if (board.visibility === 'PUBLIC') {
    // Readable by link. Anonymous viewers never get edit capability.
    return { access: 'viewer', canEdit: false, via: 'public_link' };
  }
  // UNLISTED: share token required.
  if (!tokenHash) {
    return context.authenticated ? { access: 'forbidden' } : { access: 'unauthenticated' };
  }
  const share = shares.find((s) => s.tokenHash === tokenHash);
  if (!share || share.boardId !== board.boardId) return { access: 'token_invalid' };
  if (share.revokedAt) return { access: 'token_revoked' };
  if (share.expiresAt && share.expiresAt <= now) return { access: 'token_expired' };
  return { access: 'viewer', canEdit: false, via: 'unlisted_token' };
}

// ---------------------------------------------------------------------------
// Item view mapping
// ---------------------------------------------------------------------------

export type BoardItemViewStateV1 =
  | { state: 'available' }
  | { state: 'look_unavailable' }
  | { state: 'version_unavailable' };

/** Minimal look projection the view mapping needs (never the EditorDoc). */
export type BoardLookRefV1 =
  | { readModelKind: 'CANONICAL'; designVersionId: string }
  | { readModelKind: 'LEGACY_PARTIAL'; designVersionId: undefined }
  | null;

/**
 * Map a saved item + resolved look to an honest view state:
 *  - missing/deleted look → look_unavailable;
 *  - legacy-unversioned item → available (explicit inspiration reference);
 *  - canonical item → available only when the look is CANONICAL and its
 *    designVersionId matches exactly; otherwise version_unavailable.
 */
export function resolveItemViewState(item: BoardItemV1, look: BoardLookRefV1): BoardItemViewStateV1 {
  if (!look) return { state: 'look_unavailable' };
  if (item.sourceKind === 'LEGACY_UNVERSIONED') return { state: 'available' };
  if (look.readModelKind === 'CANONICAL' && look.designVersionId === item.designVersionId) {
    return { state: 'available' };
  }
  return { state: 'version_unavailable' };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Canonical dedupe key: same sourceKind + lookId + exact designVersionId. */
export function boardItemDedupeKey(
  item: Pick<BoardItemV1, 'sourceKind' | 'lookId' | 'designVersionId'>,
): string {
  return `${item.sourceKind}|${item.lookId}|${item.designVersionId ?? ''}`;
}

/** Fresh empty store (used when nothing is persisted or storage is corrupted). */
export function createEmptyStore(now: string): NailBoardStoreV1 {
  return {
    schemaVersion: NAIL_BOARD_SCHEMA_VERSION,
    kind: NAIL_BOARD_STORE_KIND,
    boards: [],
    shares: [],
    updatedAt: now,
  };
}

/** Deep clone helper for repository boundaries (browser + Node >= 18). */
export function cloneBoard<T>(value: T): T {
  return structuredClone(value);
}
