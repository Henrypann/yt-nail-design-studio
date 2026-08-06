/**
 * V6 persistence layer (PR-04).
 * Extends the existing repo.ts with v6-specific save/load/duplicate.
 * All storage I/O goes through the existing StorageKeys + writeEnvelope.
 */

import { readData, writeEnvelope, StorageKeys } from '@/lib/storage';
import type { DesignSummary } from '@/lib/types';
import { createEmptyEditorDocV6, type EditorDocV6 } from '../v6/model';
import { getEditorDocV6Result as getEditorDocV6ResultFromMap, saveEditorDocV6ToMap, type EditorDocV6SaveResult, type EditorDocV6MigrationResult } from '../v6/repository-contract';
import { classifyEditorDocSchemaVersion } from './editor-doc-schema-version';

/* ── Design summary CRUD (shared with repo.ts) ────────── */

export function readDesigns(): DesignSummary[] {
  return readData<DesignSummary[]>(StorageKeys.designs) ?? [];
}

export function writeDesigns(designs: DesignSummary[]): void {
  writeEnvelope(StorageKeys.designs, designs);
}

export function getDesign(id: string): DesignSummary | undefined {
  return readDesigns().find((d) => d.id === id);
}

export function upsertDesign(design: DesignSummary): void {
  const designs = readDesigns();
  const idx = designs.findIndex((d) => d.id === design.id);
  if (idx >= 0) designs[idx] = design;
  else designs.unshift(design);
  writeDesigns(designs);
}

export function removeDesign(id: string): void {
  writeDesigns(readDesigns().filter((d) => d.id !== id));
  removeEditorDoc(id);
}

/* ── EditorDoc storage map ─────────────────────────────── */

type EditorDocMap = Record<string, unknown>;

function readEditorDocs(): EditorDocMap {
  return readData<EditorDocMap>(StorageKeys.editorDocs) ?? {};
}

function writeEditorDocs(map: EditorDocMap): void {
  writeEnvelope(StorageKeys.editorDocs, map);
}

/* ── V6 load (pure migration, no storage writes) ───────── */

export function getEditorDocV6Result(designId: string): EditorDocV6MigrationResult {
  return getEditorDocV6ResultFromMap(readEditorDocs(), designId);
}

/* ── V6 save (explicit schema-6 boundary) ──────────────── */

export function saveEditorDocV6ToLocalStorage(doc: EditorDocV6): EditorDocV6SaveResult {
  const map = readEditorDocs();
  const result = saveEditorDocV6ToMap(map, doc);
  if (result.status === 'ok') {
    writeEditorDocs(map);
  }
  return result;
}

/* ── Version-neutral probes (shared with Community) ────── */

export function hasEditorDocRaw(designId: string): boolean {
  return Object.prototype.hasOwnProperty.call(readEditorDocs(), designId);
}

export function hasEditorDoc(designId: string): boolean {
  return hasEditorDocRaw(designId);
}

export type EditorDocProbe =
  | { present: false }
  | {
      present: true;
      schemaVersion: number | null;
      kind: 'supported' | 'unsupported' | 'invalid' | 'unknown';
    };

export function inspectEditorDoc(designId: string): EditorDocProbe {
  if (!hasEditorDocRaw(designId)) return { present: false };
  const raw = readEditorDocs()[designId];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { present: true, schemaVersion: null, kind: 'invalid' };
  }
  const classified = classifyEditorDocSchemaVersion(
    (raw as { schemaVersion?: unknown }).schemaVersion,
  );
  return {
    present: true,
    schemaVersion: classified.schemaVersion,
    kind: classified.kind,
  };
}

/* ── Remove ────────────────────────────────────────────── */

export function removeEditorDoc(designId: string): void {
  const map = readEditorDocs();
  if (designId in map) {
    delete map[designId];
    writeEditorDocs(map);
  }
}

/* ── Duplicate ─────────────────────────────────────────── */

export function duplicateEditorDocV6(sourceId: string, newDesignId: string): string | null {
  const result = getEditorDocV6Result(sourceId);
  if (result.status !== 'ok') return null;
  const newDoc: EditorDocV6 = {
    ...structuredClone(result.doc),
    designId: newDesignId,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const saveResult = saveEditorDocV6ToLocalStorage(newDoc);
  return saveResult.status === 'ok' ? newDesignId : null;
}

/* ── Create blank design with v6 doc ───────────────────── */

export function createBlankEditorDesignV6(opts: {
  shape?: string;
  length?: string;
  customerId?: string;
  baseColor?: string;
  title?: string;
}): string {
  const genIdPrefix = 'design';
  const id = `${genIdPrefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const doc = createEmptyEditorDocV6({
    designId: id,
    customerId: opts.customerId,
    title: opts.title ?? '自由画布设计',
    shape: opts.shape as EditorDocV6['defaultGeometry']['shape'] | undefined,
    length: opts.length as EditorDocV6['defaultGeometry']['length'] | undefined,
    baseColor: opts.baseColor,
  });

  saveEditorDocV6ToLocalStorage(doc);

  upsertDesign({
    id,
    customerId: opts.customerId ?? '',
    title: doc.title,
    shape: doc.defaultGeometry.shape,
    length: doc.defaultGeometry.length,
    baseColor: opts.baseColor ?? '#FBF5F0',
    finish: doc.appearance.topFinish === 'matte' ? 'matte' : 'gloss',
    status: 'draft',
    source: 'editor',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export type { EditorDocV6, EditorDocV6MigrationResult, EditorDocV6SaveResult };
