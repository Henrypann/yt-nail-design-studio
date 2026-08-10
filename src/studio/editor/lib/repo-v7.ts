import { createClientId } from '@/lib/storage';
import type { DesignSummary, NailLength, NailShape } from '@/lib/types';
import { createBlankEditorDocV7, wizardDesignToEditorDocV7 } from '../v7/create';
import type { EditorDocV7CreationFailure } from '../v7/create';
import { createEditorDocV7InLocalStorage, type EditorDocV7CreateResult } from '../v7/repository';
import { removeEditorDoc, upsertDesign } from './repo-v6';

export type CreateWizardEditorDocV7Result =
  | { ok: true; doc: Extract<EditorDocV7CreateResult, { ok: true }>['doc'] }
  | { ok: false; reason: EditorDocV7CreationFailure | 'invalid_document' | 'already_exists' | 'write_failed'; message: string };

export function createWizardEditorDocV7(design: DesignSummary): CreateWizardEditorDocV7Result {
  const converted = wizardDesignToEditorDocV7(design);
  if (!converted.ok) return converted;
  return createEditorDocV7InLocalStorage(converted.doc);
}

export function createBlankEditorDesignV7(opts: {
  shape: NailShape;
  length: NailLength;
  customerId?: string;
  baseColor?: string;
  title?: string;
}): string {
  const id = createClientId('design_');
  const now = new Date().toISOString();
  const created = createBlankEditorDocV7({
    designId: id,
    shape: opts.shape,
    length: opts.length,
    customerRef: opts.customerId,
    title: opts.title,
    baseColor: opts.baseColor,
    now,
  });
  if (!created.ok) throw new Error(created.message);
  const saved: EditorDocV7CreateResult = createEditorDocV7InLocalStorage(created.doc);
  if (!saved.ok) throw new Error(saved.message);
  try {
    upsertDesign({
      id,
      customerId: opts.customerId ?? '',
      title: created.doc.title,
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
  } catch (error) {
    try { removeEditorDoc(id); } catch { /* original storage failure wins */ }
    throw error;
  }
  return id;
}
