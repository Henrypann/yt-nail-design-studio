import type { EditorDocV7 } from './model';

let activePreviewSession: EditorDocV7 | null = null;

export function captureCustomerPreviewSessionV7(doc: EditorDocV7): void {
  activePreviewSession = structuredClone(doc);
}

export function readCustomerPreviewSessionV7(designId: string): EditorDocV7 | null {
  if (activePreviewSession?.designId !== designId) return null;
  return structuredClone(activePreviewSession);
}

export function clearCustomerPreviewSessionV7(designId?: string): void {
  if (designId === undefined || activePreviewSession?.designId === designId) activePreviewSession = null;
}
