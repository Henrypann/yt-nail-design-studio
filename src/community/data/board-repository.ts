/**
 * Community V7.1 · COMM-V7.1-03 Nail Board — versioned local repository.
 *
 * The repository owns persistence, identity injection, optimistic concurrency
 * and share-token cryptography. All dependencies are injectable for tests:
 *
 *   StorageLike  — versioned local persistence (read/write). `write` must throw
 *                  on failure so commands fail atomically: one write per
 *                  successful command, ZERO writes on no-op or failure. A
 *                  failed delete/reorder never mutates the canonical state.
 *   ClockLike    — ISO-8601 clock (injected, never `Date.now()` in commands).
 *   IdLike       — globally-unique id source (board/item/share ids).
 *   TokenLike    — Web Crypto random token + SHA-256 hash. Only the hash is
 *                  persisted; the raw token is returned exactly once.
 *   AccessProviderLike — typed access context. This repo has no real auth/
 *                  backend: the browser default is a DISCLOSED local-demo
 *                  identity; the share route uses the anonymous context.
 *
 * Storage parsing fails CLOSED: corrupted data never throws out of the
 * repository — commands refuse to act (`storage_corrupted`) so a broken blob is
 * never silently overwritten or partially applied.
 *
 * This module is Node-testable: no `import.meta.env`, no `@/` imports, and no
 * parameter properties (Node `--experimental-strip-types` constraint).
 */

import {
  MAX_BOARD_TITLE_LENGTH,
  NAIL_BOARD_SCHEMA_VERSION,
  boardItemDedupeKey,
  cloneBoard,
  createBoardCommand,
  createEmptyStore,
  createShareCommand,
  deleteItemCommand,
  parseNailBoardStoreV1,
  renameBoardCommand,
  resolveBoardAccess,
  reorderItemCommand,
  revokeShareCommand,
  saveItemCommand,
  setVisibilityCommand,
  type BoardAccessContextV1,
  type BoardAccessResolutionV1,
  type BoardCommandErrorCode,
  type BoardItemSourceKindV1,
  type BoardItemV1,
  type BoardShareLinkV1,
  type NailBoardStoreV1,
  type NailBoardV1,
  type NailBoardVisibilityV1,
} from '../domain/v7_1/nail-board';

// ---------------------------------------------------------------------------
// Injectable dependencies
// ---------------------------------------------------------------------------

export interface StorageLike {
  /** Raw persisted envelope or null when nothing is stored yet. Never throws. */
  read(): string | null;
  /** Persist the full envelope atomically. MUST throw on failure. */
  write(value: string): void;
}

export interface ClockLike {
  /** ISO-8601 UTC timestamp with millisecond precision. */
  now(): string;
}

export interface IdLike {
  /** Globally unique id (board / item / share ids). */
  nextId(): string;
}

export interface TokenLike {
  /** Cryptographically unguessable raw share token (returned once, never stored). */
  generateToken(): string;
  /** SHA-256 hex digest of a token. */
  hashToken(token: string): Promise<string>;
}

export interface AccessProviderLike {
  getAccess(): BoardAccessContextV1;
}

export interface BoardRepositoryDeps {
  storage: StorageLike;
  clock: ClockLike;
  id: IdLike;
  token: TokenLike;
  access: AccessProviderLike;
}

// ---------------------------------------------------------------------------
// Defaults (browser / demo)
// ---------------------------------------------------------------------------

/** Disclosed local-demo identity — this repo has no real auth/backend. */
export const LOCAL_DEMO_IDENTITY_ID = 'local-demo-identity';

export const NAIL_BOARD_STORAGE_KEY = 'nail-board-store-v1';

export function localDemoAccessProvider(): BoardAccessContextV1 {
  return {
    authenticated: true,
    identityId: LOCAL_DEMO_IDENTITY_ID,
    disclosure: 'local_demo',
    note: 'Local prototype: no real auth/backend. The current user is the disclosed local-demo identity and boards live only in this browser.',
  };
}

/** Anonymous context used by the read-only share route. */
export function anonymousAccessProvider(): BoardAccessContextV1 {
  return { authenticated: false, disclosure: 'none' };
}

export const isoClock: ClockLike = {
  now(): string {
    return new Date().toISOString();
  },
};

const B64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64URL_CHARS[b0 >> 2];
    out += B64URL_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64URL_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '';
    out += i + 2 < bytes.length ? B64URL_CHARS[b2 & 63] : '';
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function webCrypto(): Crypto | null {
  const maybe = globalThis.crypto as Crypto | undefined;
  return maybe && typeof maybe.getRandomValues === 'function' ? maybe : null;
}

/**
 * Web Crypto token source: 32 random bytes → base64url (43 chars), SHA-256 hex
 * hash for persistence. Fails loudly when Web Crypto is unavailable rather than
 * silently degrading to a predictable generator.
 */
export const webCryptoToken: TokenLike = {
  generateToken(): string {
    const crypto = webCrypto();
    if (!crypto) {
      throw new Error('Web Crypto unavailable: cannot generate an unguessable share token');
    }
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
  },
  async hashToken(token: string): Promise<string> {
    const crypto = webCrypto();
    if (!crypto || typeof crypto.subtle?.digest !== 'function') {
      throw new Error('Web Crypto unavailable: cannot hash a share token');
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return toHex(new Uint8Array(digest));
  },
};

/** Browser default storage: localStorage with the versioned key, fail-closed read. */
export function localStorageBackedStorage(key: string): StorageLike {
  return {
    read(): string | null {
      if (!globalThis.localStorage) throw new Error('localStorage unavailable');
      const value = globalThis.localStorage.getItem(key);
      return typeof value === 'string' ? value : null;
    },
    write(value: string): void {
      // Throws on quota/security failure so the command fails atomically.
      if (!globalThis.localStorage) throw new Error('localStorage unavailable');
      globalThis.localStorage.setItem(key, value);
    },
  };
}

export function createBrowserBoardRepository(): BoardRepository {
  return new BoardRepository({
    storage: localStorageBackedStorage(NAIL_BOARD_STORAGE_KEY),
    clock: isoClock,
    id: {
      nextId(): string {
        const crypto = webCrypto();
        if (!crypto || typeof crypto.randomUUID !== 'function') {
          throw new Error('Web Crypto unavailable: cannot generate an id');
        }
        return crypto.randomUUID();
      },
    },
    token: webCryptoToken,
    access: { getAccess: localDemoAccessProvider },
  });
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export type BoardRepoErrorCode =
  | BoardCommandErrorCode
  | 'storage_corrupted'
  | 'persist_failed'
  | 'token_unavailable'
  | 'token_invalid';

export type BoardRepoResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: BoardRepoErrorCode; message: string };

export interface BoardWithShares {
  board: NailBoardV1 | null;
  shares: BoardShareLinkV1[];
  corrupted: boolean;
}

export class BoardRepository {
  readonly deps: BoardRepositoryDeps;

  constructor(deps: BoardRepositoryDeps) {
    this.deps = deps;
  }

  // -- read side ------------------------------------------------------------

  /**
   * Parse the persisted store. Corrupted storage fails CLOSED: returns an empty
   * store flagged `corrupted: true` and never throws. Commands refuse to act on
   * a corrupted store so the broken blob is not overwritten.
   */
  readStore(): { store: NailBoardStoreV1; corrupted: boolean } {
    let raw: string | null;
    try {
      raw = this.deps.storage.read();
    } catch {
      // Storage security/access failures are not equivalent to an empty store.
      // Fail closed so a later command can never claim success or overwrite data.
      return { store: createEmptyStore(this.deps.clock.now()), corrupted: true };
    }
    if (raw === null) {
      return { store: createEmptyStore(this.deps.clock.now()), corrupted: false };
    }
    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(raw);
    } catch {
      // Malformed JSON: fail closed, never throw.
      return { store: createEmptyStore(this.deps.clock.now()), corrupted: true };
    }
    const parsed = parseNailBoardStoreV1(parsedInput);
    if (!parsed.ok) {
      return { store: createEmptyStore(this.deps.clock.now()), corrupted: true };
    }
    return { store: parsed.value, corrupted: false };
  }

  /** List boards owned by the current access context (fresh clones). */
  listBoards(): { boards: NailBoardV1[]; corrupted: boolean } {
    const { store, corrupted } = this.readStore();
    const access = this.deps.access.getAccess();
    const mine = store.boards
      .filter((board) => access.authenticated && board.ownerIdentityId === access.identityId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return { boards: mine.map(cloneBoard), corrupted };
  }

  getBoard(boardId: string): BoardWithShares {
    const { store, corrupted } = this.readStore();
    const board = store.boards.find((b) => b.boardId === boardId) ?? null;
    const shares = store.shares.filter((s) => s.boardId === boardId).map((s) => ({ ...s }));
    return { board: board ? cloneBoard(board) : null, shares, corrupted };
  }

  /**
   * Boards (with their matching item) that already contain the dedupe key —
   * used by the Save dialog to show the honest already-saved state.
   */
  findSavedBoards(input: {
    lookId: string;
    sourceKind: BoardItemSourceKindV1;
    designVersionId: string | null;
  }): { boards: Array<{ board: NailBoardV1; item: BoardItemV1 }>; corrupted: boolean } {
    const { store, corrupted } = this.readStore();
    const access = this.deps.access.getAccess();
    const dedupeKey = boardItemDedupeKey(input);
    const hits: Array<{ board: NailBoardV1; item: BoardItemV1 }> = [];
    for (const board of store.boards) {
      if (!access.authenticated || board.ownerIdentityId !== access.identityId) continue;
      const item = board.items.find((candidate) => boardItemDedupeKey(candidate) === dedupeKey);
      if (item) hits.push({ board: cloneBoard(board), item: { ...item } });
    }
    return { boards: hits, corrupted };
  }

  /**
   * Resolve access for a route by raw token. The raw token is hashed here and
   * never persisted; the domain only ever sees the hash.
   */
  async resolveAccess(
    boardId: string,
    rawToken?: string,
  ): Promise<BoardRepoResult<{ board: NailBoardV1; shares: BoardShareLinkV1[]; access: BoardAccessResolutionV1 }>> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const board = store.boards.find((b) => b.boardId === boardId);
    if (!board) return repoErr('board_not_found', `board "${boardId}" not found`);
    const shares = store.shares.filter((s) => s.boardId === boardId);
    let tokenHash: string | undefined;
    if (rawToken) {
      try {
        tokenHash = await this.deps.token.hashToken(rawToken);
      } catch (error) {
        return repoErr('token_unavailable', error instanceof Error ? error.message : 'token hashing failed');
      }
    }
    const access = resolveBoardAccess(board, shares, anonymousAccessProvider(), tokenHash, this.deps.clock.now());
    return { ok: true, value: { board: cloneBoard(board), shares: shares.map((s) => ({ ...s })), access } };
  }

  /**
   * Resolve access for the anonymous share route by raw token. The token is
   * hashed here (never persisted); the domain only sees the hash. The board id
   * is derived from the share record, so the URL carries no owner identity.
   */
  async resolveAccessByToken(
    rawToken: string,
  ): Promise<BoardRepoResult<{ board: NailBoardV1; shares: BoardShareLinkV1[]; access: BoardAccessResolutionV1 }>> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted');
    let tokenHash: string;
    try {
      tokenHash = await this.deps.token.hashToken(rawToken);
    } catch (error) {
      return repoErr('token_unavailable', error instanceof Error ? error.message : 'token hashing failed');
    }
    const share = store.shares.find((s) => s.tokenHash === tokenHash);
    if (!share) return repoErr('token_invalid', 'unknown share token');
    const board = store.boards.find((b) => b.boardId === share.boardId);
    if (!board) return repoErr('board_not_found', `board "${share.boardId}" no longer exists`);
    const boardShares = store.shares.filter((s) => s.boardId === board.boardId);
    const access = resolveBoardAccess(board, boardShares, anonymousAccessProvider(), tokenHash, this.deps.clock.now());
    return {
      ok: true,
      value: {
        board: cloneBoard(board),
        shares: boardShares.map((s) => ({ ...s })),
        access,
      },
    };
  }

  // -- commands -------------------------------------------------------------

  createBoard(title: string): BoardRepoResult<{ board: NailBoardV1 }> {
    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_BOARD_TITLE_LENGTH) {
      return repoErr('invalid_input', `title must be 1..${MAX_BOARD_TITLE_LENGTH} characters`);
    }
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const access = this.deps.access.getAccess();
    if (!access.authenticated || !access.identityId) {
      return repoErr('unauthenticated', 'creating a board requires an authenticated identity');
    }
    const result = createBoardCommand({
      boardId: this.deps.id.nextId(),
      ownerIdentityId: access.identityId,
      title: trimmed,
      now: this.deps.clock.now(),
    });
    if (!result.ok) return result;
    const nextStore: NailBoardStoreV1 = {
      ...store,
      boards: [...store.boards, result.state.board],
      updatedAt: this.deps.clock.now(),
    };
    return this.persistAndReturn(nextStore, { board: result.state.board });
  }

  deleteBoard(boardId: string, expectedRevision: number): BoardRepoResult<{ board: NailBoardV1 }> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const guard = this.requireOwner(store, boardId);
    if (!guard.ok) return guard;
    if (guard.board.revision !== expectedRevision) {
      return repoErr('revision_conflict', `expected revision ${expectedRevision}, got ${guard.board.revision}`);
    }
    const nextStore: NailBoardStoreV1 = {
      ...store,
      boards: store.boards.filter((b) => b.boardId !== boardId),
      shares: store.shares.filter((s) => s.boardId !== boardId),
      updatedAt: this.deps.clock.now(),
    };
    return this.persistAndReturn(nextStore, { board: guard.board });
  }

  saveItem(input: {
    boardId: string;
    lookId: string;
    sourceKind: BoardItemSourceKindV1;
    designVersionId: string | null;
    expectedRevision: number;
  }): BoardRepoResult<{ board: NailBoardV1; item: BoardItemV1; changed: boolean }> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const guard = this.requireOwner(store, input.boardId);
    if (!guard.ok) return guard;
    if (guard.board.revision !== input.expectedRevision) {
      return repoErr('revision_conflict', `expected revision ${input.expectedRevision}, got ${guard.board.revision}`);
    }
    const now = this.deps.clock.now();
    const result = saveItemCommand(
      { board: guard.board, shares: store.shares.filter((s) => s.boardId === input.boardId) },
      {
        itemId: this.deps.id.nextId(),
        lookId: input.lookId,
        sourceKind: input.sourceKind,
        designVersionId: input.designVersionId,
        savedAt: now,
        now,
      },
    );
    if (!result.ok) return result;
    if (!result.changed) {
      const item = guard.board.items.find(
        (candidate) => boardItemDedupeKey(candidate) === boardItemDedupeKey(input),
      );
      return {
        ok: true,
        value: {
          board: cloneBoard(guard.board),
          item: item ? { ...item } : { ...guard.board.items[guard.board.items.length - 1] },
          changed: false,
        },
      };
    }
    const nextStore = this.replaceBoard(store, result.state.board);
    return this.persistAndReturn(nextStore, {
      board: result.state.board,
      item: result.state.board.items[result.state.board.items.length - 1],
      changed: true,
    });
  }

  deleteItem(boardId: string, itemId: string, expectedRevision: number): BoardRepoResult<{ board: NailBoardV1 }> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const guard = this.requireOwner(store, boardId);
    if (!guard.ok) return guard;
    if (guard.board.revision !== expectedRevision) {
      return repoErr('revision_conflict', `expected revision ${expectedRevision}, got ${guard.board.revision}`);
    }
    const result = deleteItemCommand(
      { board: guard.board, shares: store.shares.filter((s) => s.boardId === boardId) },
      { itemId, now: this.deps.clock.now() },
    );
    if (!result.ok) return result;
    const nextStore = this.replaceBoard(store, result.state.board);
    return this.persistAndReturn(nextStore, { board: result.state.board });
  }

  reorderItem(
    boardId: string,
    itemId: string,
    toIndex: number,
    expectedRevision: number,
  ): BoardRepoResult<{ board: NailBoardV1; changed: boolean }> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const guard = this.requireOwner(store, boardId);
    if (!guard.ok) return guard;
    if (guard.board.revision !== expectedRevision) {
      return repoErr('revision_conflict', `expected revision ${expectedRevision}, got ${guard.board.revision}`);
    }
    const result = reorderItemCommand(
      { board: guard.board, shares: store.shares.filter((s) => s.boardId === boardId) },
      { itemId, toIndex, now: this.deps.clock.now() },
    );
    if (!result.ok) return result;
    if (!result.changed) {
      return { ok: true, value: { board: cloneBoard(guard.board), changed: false } };
    }
    const nextStore = this.replaceBoard(store, result.state.board);
    return this.persistAndReturn(nextStore, { board: result.state.board, changed: true });
  }

  renameBoard(boardId: string, title: string, expectedRevision: number): BoardRepoResult<{ board: NailBoardV1 }> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const guard = this.requireOwner(store, boardId);
    if (!guard.ok) return guard;
    if (guard.board.revision !== expectedRevision) {
      return repoErr('revision_conflict', `expected revision ${expectedRevision}, got ${guard.board.revision}`);
    }
    const result = renameBoardCommand(
      { board: guard.board, shares: store.shares.filter((s) => s.boardId === boardId) },
      { title, now: this.deps.clock.now() },
    );
    if (!result.ok) return result;
    if (!result.changed) {
      return { ok: true, value: { board: cloneBoard(guard.board) } };
    }
    const nextStore = this.replaceBoard(store, result.state.board);
    return this.persistAndReturn(nextStore, { board: result.state.board });
  }

  /**
   * Visibility transition. PUBLIC requires the caller to pass an explicit
   * `publicConfirmed: true` (the UI only does so from a confirmation dialog).
   * Returning to PRIVATE also revokes every active share link atomically.
   */
  setVisibility(
    boardId: string,
    visibility: NailBoardVisibilityV1,
    publicConfirmed: boolean,
    expectedRevision: number,
  ): BoardRepoResult<{ board: NailBoardV1; revokedShareCount: number }> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const guard = this.requireOwner(store, boardId);
    if (!guard.ok) return guard;
    if (guard.board.revision !== expectedRevision) {
      return repoErr('revision_conflict', `expected revision ${expectedRevision}, got ${guard.board.revision}`);
    }
    const now = this.deps.clock.now();
    const result = setVisibilityCommand(
      { board: guard.board, shares: store.shares.filter((s) => s.boardId === boardId) },
      { visibility, publicConfirmed, now },
    );
    if (!result.ok) return result;
    if (!result.changed) {
      return { ok: true, value: { board: cloneBoard(guard.board), revokedShareCount: 0 } };
    }
    // Returning to PRIVATE revokes all active share links in the same atomic write.
    let nextShares = store.shares.map((s) => ({ ...s }));
    let revokedShareCount = 0;
    if (visibility === 'PRIVATE') {
      nextShares = nextShares.map((s) => {
        if (s.boardId === boardId && !s.revokedAt) {
          revokedShareCount += 1;
          return { ...s, revokedAt: now };
        }
        return s;
      });
    }
    const nextStore: NailBoardStoreV1 = {
      ...store,
      boards: store.boards.map((b) => (b.boardId === boardId ? result.state.board : b)),
      shares: nextShares,
      updatedAt: now,
    };
    return this.persistAndReturn(nextStore, { board: result.state.board, revokedShareCount });
  }

  /**
   * Create share metadata for an UNLISTED/PUBLIC board. The raw token is
   * generated and hashed here: only the hash is persisted, and the raw token is
   * returned exactly once for URL construction. PRIVATE boards fail with
   * `private_not_shareable`.
   */
  async createShareLink(
    boardId: string,
    options?: { expiresAt?: string },
  ): Promise<BoardRepoResult<{ token: string; share: BoardShareLinkV1 }>> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const guard = this.requireOwner(store, boardId);
    if (!guard.ok) return guard;
    if (guard.board.visibility === 'PRIVATE') {
      return repoErr('private_not_shareable', 'PRIVATE boards are never anonymously shareable');
    }
    let token: string;
    let tokenHash: string;
    try {
      token = this.deps.token.generateToken();
      tokenHash = await this.deps.token.hashToken(token);
    } catch (error) {
      return repoErr('token_unavailable', error instanceof Error ? error.message : 'share token generation failed');
    }
    const now = this.deps.clock.now();
    const result = createShareCommand(
      { board: guard.board, shares: store.shares.filter((s) => s.boardId === boardId) },
      {
        shareId: this.deps.id.nextId(),
        tokenHash,
        createdAt: now,
        expiresAt: options?.expiresAt,
      },
    );
    if (!result.ok) return result;
    const share = result.state.shares.find((s) => s.tokenHash === tokenHash);
    if (!result.changed || !share) {
      return { ok: true, value: { token, share: { ...(share as BoardShareLinkV1) } } };
    }
    const nextStore: NailBoardStoreV1 = {
      ...store,
      shares: [...store.shares, share],
      updatedAt: now,
    };
    const persisted = this.persistAndReturn(nextStore, { token, share });
    return persisted;
  }

  revokeShare(boardId: string, shareId: string): BoardRepoResult<{ share: BoardShareLinkV1 }> {
    const { store, corrupted } = this.readStore();
    if (corrupted) return repoErr('storage_corrupted', 'local storage is corrupted; writes are disabled until it is cleared');
    const guard = this.requireOwner(store, boardId);
    if (!guard.ok) return guard;
    const result = revokeShareCommand(
      { board: guard.board, shares: store.shares.filter((s) => s.boardId === boardId) },
      { shareId, now: this.deps.clock.now() },
    );
    if (!result.ok) return result;
    if (!result.changed) {
      const existing = store.shares.find((s) => s.shareId === shareId);
      return { ok: true, value: { share: { ...(existing as BoardShareLinkV1) } } };
    }
    const updatedShare = result.state.shares.find((s) => s.shareId === shareId);
    const nextStore: NailBoardStoreV1 = {
      ...store,
      shares: store.shares.map((s) => (s.shareId === shareId ? (updatedShare as BoardShareLinkV1) : s)),
      updatedAt: this.deps.clock.now(),
    };
    return this.persistAndReturn(nextStore, { share: updatedShare as BoardShareLinkV1 });
  }

  // -- internals ------------------------------------------------------------

  private requireOwner(
    store: NailBoardStoreV1,
    boardId: string,
  ): { ok: true; board: NailBoardV1 } | { ok: false; code: BoardRepoErrorCode; message: string } {
    const access = this.deps.access.getAccess();
    if (!access.authenticated) {
      return { ok: false, code: 'unauthenticated' as const, message: 'this action requires an authenticated identity' };
    }
    const board = store.boards.find((b) => b.boardId === boardId);
    if (!board) return { ok: false, code: 'board_not_found' as const, message: `board "${boardId}" not found` };
    if (board.ownerIdentityId !== access.identityId) {
      return { ok: false, code: 'forbidden' as const, message: 'only the board owner can perform this action' };
    }
    return { ok: true, board };
  }

  private replaceBoard(store: NailBoardStoreV1, board: NailBoardV1): NailBoardStoreV1 {
    return {
      ...store,
      boards: store.boards.map((b) => (b.boardId === board.boardId ? board : b)),
      updatedAt: this.deps.clock.now(),
    };
  }

  private persistAndReturn<T>(nextStore: NailBoardStoreV1, value: T): BoardRepoResult<T> {
    try {
      this.deps.storage.write(JSON.stringify(nextStore));
    } catch (error) {
      // Storage failure: canonical state was not mutated (nextStore was never
      // applied); report the failure so the UI keeps its previous state.
      return repoErr('persist_failed', error instanceof Error ? error.message : 'storage write failed');
    }
    return { ok: true, value };
  }
}

export function repoErr(code: BoardRepoErrorCode, message: string): BoardRepoResult<never> {
  return { ok: false, code, message };
}

/** Convenience type re-export used by UI code. */
export type { NailBoardV1, BoardItemV1, BoardShareLinkV1, NailBoardVisibilityV1, BoardItemSourceKindV1 };
export { NAIL_BOARD_SCHEMA_VERSION };
