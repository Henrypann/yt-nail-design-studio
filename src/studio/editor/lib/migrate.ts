import type { FingerCode, Finish, NailLength, NailShape } from '../../../lib/types.ts';
import {
  LENGTH_PRESET_BY_GEOMETRY,
  appearanceFromLegacyFinish,
  type AttachmentElement,
  type EditorDoc,
  type FingerData,
  type PatternElement,
  type SurfaceAppearance,
} from './model.ts';

export type EditorDocMigrationResult =
  | { status: 'ok'; doc: EditorDoc; migrated: boolean }
  | { status: 'missing' }
  | { status: 'invalid'; reason: string }
  | { status: 'unsupported'; version: number };

type UnknownRecord = Record<string, unknown>;

const PATTERN_KINDS = new Set(['template_pattern', 'brush', 'eraser', 'image', 'gradient', 'french_edge']);
const LENGTHS = new Set<NailLength>(['short', 'medium', 'long', 'extra-long']);

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function defaultPatternName(raw: UnknownRecord): string {
  switch (raw.kind) {
    case 'template_pattern':
      return typeof raw.name === 'string' ? raw.name : '模板图案';
    case 'brush':
      return '手绘笔画';
    case 'eraser':
      return '擦除蒙版';
    case 'image':
      return typeof raw.name === 'string' ? raw.name : '导入图片';
    case 'gradient':
      return '裸色渐变';
    case 'french_edge':
      return '经典法式';
    default:
      return '图案元素';
  }
}

function normalizePattern(value: unknown, order: number): PatternElement | null {
  const raw = record(value);
  if (!raw || typeof raw.id !== 'string' || !PATTERN_KINDS.has(String(raw.kind))) return null;
  return {
    ...raw,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : defaultPatternName(raw),
    visible: raw.visible !== false,
    locked: raw.locked === true,
    order,
  } as unknown as PatternElement;
}

function normalizeAttachment(value: unknown, order: number): AttachmentElement | null {
  const raw = record(value);
  if (
    !raw ||
    raw.kind !== 'attachment' ||
    typeof raw.id !== 'string' ||
    typeof raw.decorationId !== 'string'
  ) {
    return null;
  }
  return {
    ...raw,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : '附件',
    visible: raw.visible !== false,
    locked: raw.locked === true,
    order,
  } as unknown as AttachmentElement;
}

function normalizeFingerData(value: unknown): FingerData | null {
  const raw = record(value);
  if (!raw || typeof raw.baseColor !== 'string') return null;
  const pattern = Array.isArray(raw.pattern)
    ? raw.pattern.map(normalizePattern).filter((item): item is PatternElement => item !== null)
    : [];
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .map(normalizeAttachment)
        .filter((item): item is AttachmentElement => item !== null)
    : [];
  return { baseColor: raw.baseColor, pattern, attachments };
}

function normalizeAppearance(value: unknown, fallbackFinish: Finish = 'gloss'): SurfaceAppearance {
  const raw = record(value);
  if (!raw) return appearanceFromLegacyFinish(fallbackFinish);
  const baseCoverage = raw.baseCoverage === 'translucent' ? 'translucent' : 'opaque';
  const opticalEffect =
    raw.opticalEffect === 'cat-eye' ||
    raw.opticalEffect === 'aurora' ||
    raw.opticalEffect === 'silk' ||
    raw.opticalEffect === 'pearl'
      ? raw.opticalEffect
      : 'none';
  const topFinish = raw.topFinish === 'matte' ? 'matte' : 'gloss';
  return { baseCoverage, opticalEffect, topFinish };
}

function migrateKnown(raw: UnknownRecord, migrated: boolean): EditorDocMigrationResult {
  if (
    typeof raw.designId !== 'string' ||
    typeof raw.shape !== 'string' ||
    typeof raw.length !== 'string' ||
    !LENGTHS.has(raw.length as NailLength) ||
    typeof raw.baseColor !== 'string' ||
    typeof raw.updatedAt !== 'string'
  ) {
    return { status: 'invalid', reason: 'Editor 文档缺少必要字段' };
  }

  const length = raw.length as NailLength;
  const pattern = Array.isArray(raw.pattern)
    ? raw.pattern.map(normalizePattern).filter((item): item is PatternElement => item !== null)
    : [];
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .map(normalizeAttachment)
        .filter((item): item is AttachmentElement => item !== null)
    : [];
  const fingerLocks: Partial<Record<FingerCode, FingerData>> = {};
  const rawLocks = record(raw.fingerLocks);
  if (rawLocks) {
    for (const [finger, value] of Object.entries(rawLocks)) {
      const normalized = normalizeFingerData(value);
      if (normalized) fingerLocks[finger as FingerCode] = normalized;
    }
  }

  const legacyFinish =
    raw.finish === 'matte' || raw.finish === 'pearl' || raw.finish === 'gloss'
      ? raw.finish
      : 'gloss';
  const lengthPreset =
    raw.lengthPreset === 'natural' ||
    raw.lengthPreset === 'short-extension' ||
    raw.lengthPreset === 'medium' ||
    raw.lengthPreset === 'long'
      ? raw.lengthPreset
      : LENGTH_PRESET_BY_GEOMETRY[length];

  return {
    status: 'ok',
    migrated,
    doc: {
      schemaVersion: 2,
      designId: raw.designId,
      customerId: typeof raw.customerId === 'string' ? raw.customerId : undefined,
      shape: raw.shape as NailShape,
      length,
      lengthPreset,
      appearance: normalizeAppearance(raw.appearance, legacyFinish),
      intent: record(raw.intent) as EditorDoc['intent'],
      baseColor: raw.baseColor,
      pattern,
      attachments,
      fingerLocks,
      masterFinger: (typeof raw.masterFinger === 'string' ? raw.masterFinger : 'R4') as FingerCode,
      updatedAt: raw.updatedAt,
    },
  };
}

/** 纯迁移：读取不写回；只有用户显式保存/复制时才持久化 v2。 */
export function migrateEditorDoc(value: unknown): EditorDocMigrationResult {
  if (value === undefined || value === null) return { status: 'missing' };
  const raw = record(value);
  if (!raw) return { status: 'invalid', reason: 'Editor 文档不是对象' };
  const version = Number(raw.schemaVersion);
  if (version === 1) return migrateKnown(raw, true);
  if (version === 2) return migrateKnown(raw, false);
  if (Number.isFinite(version) && version > 2) return { status: 'unsupported', version };
  return { status: 'invalid', reason: 'Editor 文档版本无效' };
}
