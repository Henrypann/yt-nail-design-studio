/**
 * 存储仓库（模块 4）：设计集合 / Editor 文档 / 客户名的 localStorage 读写。
 * 全部经 StorageKeys 注册键 + writeEnvelope/readEnvelope（数据桥约定）。
 */

import { readData, writeEnvelope, removeKey, StorageKeys } from '@/lib/storage';
import type { Customer, DesignSummary, NailLength, NailShape, ProjectV4 } from '@/lib/types';
import { createBlankDoc, genId, type EditorDoc } from './model';
import { migrateEditorDoc, type EditorDocMigrationResult } from './migrate';
import { classifyEditorDocSchemaVersion } from './editor-doc-schema-version';

/* ── 设计集合 ─────────────────────────────────────────── */

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

/* ── Editor 文档 ─────────────────────────────────────── */

type EditorDocMap = Record<string, unknown>;

export function readEditorDocs(): EditorDocMap {
  return readData<EditorDocMap>(StorageKeys.editorDocs) ?? {};
}

export function getEditorDoc(designId: string): EditorDoc | undefined {
  const result = getEditorDocResult(designId);
  return result.status === 'ok' ? result.doc : undefined;
}

export function getEditorDocResult(designId: string): EditorDocMigrationResult {
  return migrateEditorDoc(readEditorDocs()[designId]);
}

/** raw 存在与否独立于迁移结果，避免坏数据/未来版本被 Bridge 静默覆盖。 */
export function hasEditorDocRaw(designId: string): boolean {
  return Object.prototype.hasOwnProperty.call(readEditorDocs(), designId);
}

/** Version-neutral presence probe（PR-02）：不暴露 EditorDoc 类型。 */
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

/**
 * 只读 raw schema 元数据，不 migrate、不写 storage、不返回文档体。
 * 供 Community→Studio 冲突探测使用。
 */
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

export function saveEditorDoc(doc: EditorDoc): void {
  const map = readEditorDocs();
  map[doc.designId] = doc;
  writeEnvelope(StorageKeys.editorDocs, map);
}

export function removeEditorDoc(designId: string): void {
  const map = readEditorDocs();
  if (designId in map) {
    delete map[designId];
    writeEnvelope(StorageKeys.editorDocs, map);
  }
}

export function duplicateEditorDoc(sourceId: string, newDesignId: string): void {
  const sourceResult = getEditorDocResult(sourceId);
  if (sourceResult.status !== 'ok') return;
  saveEditorDoc({
    ...structuredClone(sourceResult.doc),
    designId: newDesignId,
    updatedAt: new Date().toISOString(),
  });
}

/** 空白新建（PRD §13.1 路径②）：创建 draft 设计摘要 + 空白 EditorDoc，返回 designId */
export function createBlankEditorDesign(opts: {
  shape: NailShape;
  length: NailLength;
  customerId?: string;
  baseColor?: string;
}): string {
  const id = genId('design');
  const now = new Date().toISOString();
  upsertDesign({
    id,
    customerId: opts.customerId ?? '',
    title: '自由画布设计',
    shape: opts.shape,
    length: opts.length,
    baseColor: opts.baseColor ?? '#FBF5F0',
    finish: 'gloss',
    status: 'draft',
    source: 'editor',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  saveEditorDoc(
    createBlankDoc({
      designId: id,
      customerId: opts.customerId,
      shape: opts.shape,
      length: opts.length,
      baseColor: opts.baseColor,
    }),
  );
  return id;
}

/* ── 客户（只读，客户模块负责写入） ────────────────────── */

export function readCustomers(): Customer[] {
  return readData<Customer[]>(StorageKeys.customers) ?? [];
}

export function customerName(customerId: string | undefined): string {
  if (!customerId) return '未关联客户';
  return readCustomers().find((c) => c.id === customerId)?.name ?? '未关联客户';
}

/* ── 数据桥：保存时同步写 ProjectV4 画布工作键 ──────────── */

/** EditorDoc → ProjectV4 envelope 载荷（五层底层结构，Recipe 为真源） */
export function docToProjectV4(doc: EditorDoc): ProjectV4 {
  return {
    schemaVersion: 4,
    projectId: doc.designId,
    designId: doc.designId,
    customerId: doc.customerId,
    shape: doc.shape,
    length: doc.length,
    recipeRef: doc.recipe?.recipeRef,
    recipe: doc.recipe,
    relief: doc.relief,
    layers: [
      { type: 'base', visible: true, locked: true, color: doc.baseColor, elements: [] },
      {
        type: 'pattern',
        visible: true,
        locked: false,
        elements: doc.pattern.map((el) => ({
          id: el.id,
          type: el.kind,
          transform:
            el.kind === 'brush' || el.kind === 'eraser' || el.kind === 'gradient'
              ? { x: 0, y: 0, scale: 1, rotation: 0 }
              : el.transform,
          editable: true,
          payload: {
            name: el.name,
            visible: el.visible,
            locked: el.locked,
            order: el.order,
          },
        })),
      },
      {
        type: 'decoration',
        visible: true,
        locked: false,
        elements: doc.attachments.map((el) => ({
          id: el.id,
          type: 'attachment',
          transform: el.transform,
          editable: true,
          heightMm: el.heightMm,
          payload: {
            name: el.name,
            visible: el.visible,
            locked: el.locked,
            order: el.order,
          },
        })),
      },
    ],
    fingerLocks: Object.fromEntries(Object.keys(doc.fingerLocks).map((f) => [f, true])),
    updatedAt: doc.updatedAt,
  };
}

export function writeCanvasEnvelope(doc: EditorDoc): void {
  writeEnvelope(StorageKeys.canvas, docToProjectV4(doc));
}

/** 兼容旧调用方；输出已升级为 ProjectV4。 */
export const docToProjectV3 = docToProjectV4;

/** 清空画布键（删除设计时避免脏数据回写） */
export function clearCanvasEnvelope(): void {
  removeKey(StorageKeys.canvas);
}
