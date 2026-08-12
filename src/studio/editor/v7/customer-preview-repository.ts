import { readData, StorageKeys } from '@/lib/storage';
import type { EditorDocV7 } from './model';
import { EDITOR_V7_PRODUCTION_MIGRATION_RESOLVERS } from './migration-resolvers';
import {
  getEditorDocV7Result,
  type EditorDocV7Map,
  type EditorDocV7MigrationResolvers,
} from './repository-contract';

export type CustomerPreviewLoadResultV7 =
  | { status: 'ready'; doc: EditorDocV7; warnings: string[] }
  | { status: 'missing' | 'invalid' | 'unsupported'; message: string };

export function readCustomerPreviewDocV7FromMap(
  docs: EditorDocV7Map,
  designId: string,
  resolvers: EditorDocV7MigrationResolvers = EDITOR_V7_PRODUCTION_MIGRATION_RESOLVERS,
): CustomerPreviewLoadResultV7 {
  const result = getEditorDocV7Result(docs, designId, resolvers);
  if (result.status === 'migrated' || result.status === 'migrated_with_warnings') {
    return {
      status: 'ready',
      doc: structuredClone(result.doc),
      warnings: result.diagnostics.map((diagnostic) => diagnostic.message),
    };
  }
  if (result.status === 'missing') return { status: 'missing', message: '没有找到对应设计' };
  if (result.status === 'unsupported') return { status: 'unsupported', message: '设计来自更高版本，当前预览不会覆盖原数据' };
  return { status: 'invalid', message: result.reason || '设计数据无法安全读取' };
}

/** Browser-local read boundary for customer preview. This module exposes no save API. */
export function readCustomerPreviewDocV7(designId: string): CustomerPreviewLoadResultV7 {
  const docs = readData<EditorDocV7Map>(StorageKeys.editorDocs) ?? {};
  return readCustomerPreviewDocV7FromMap(docs, designId);
}
