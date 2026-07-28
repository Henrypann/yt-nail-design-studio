/**
 * 存储仓库（模块 4）：设计集合 / Editor 文档 / 客户名的 localStorage 读写。
 * 全部经 StorageKeys 注册键 + writeEnvelope/readEnvelope（数据桥约定）。
 */

import { readData, writeEnvelope, removeKey, StorageKeys } from '@/lib/storage';
import type { Customer, DesignSummary, NailLength, NailShape, ProjectV3 } from '@/lib/types';
import { createBlankDoc, genId, type EditorDoc } from './model';

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

type EditorDocMap = Record<string, EditorDoc>;

export function readEditorDocs(): EditorDocMap {
  return readData<EditorDocMap>(StorageKeys.editorDocs) ?? {};
}

export function getEditorDoc(designId: string): EditorDoc | undefined {
  return readEditorDocs()[designId];
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
  const source = getEditorDoc(sourceId);
  if (!source) return;
  saveEditorDoc({
    ...structuredClone(source),
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

/* ── 数据桥：保存时同步写 ProjectV3 画布工作键 ──────────── */

/** EditorDoc → ProjectV3 envelope 载荷（五层底层结构，三层用户语义映射） */
export function docToProjectV3(doc: EditorDoc): ProjectV3 {
  return {
    schemaVersion: 3,
    projectId: doc.designId,
    designId: doc.designId,
    customerId: doc.customerId,
    shape: doc.shape,
    length: doc.length,
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
            el.kind === 'brush' || el.kind === 'eraser'
              ? { x: 0, y: 0, scale: 1, rotation: 0 }
              : el.transform,
          editable: true,
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
        })),
      },
    ],
    fingerLocks: Object.fromEntries(Object.keys(doc.fingerLocks).map((f) => [f, true])),
    updatedAt: doc.updatedAt,
  };
}

export function writeCanvasEnvelope(doc: EditorDoc): void {
  writeEnvelope(StorageKeys.canvas, docToProjectV3(doc));
}

/** 清空画布键（删除设计时避免脏数据回写） */
export function clearCanvasEnvelope(): void {
  removeKey(StorageKeys.canvas);
}
