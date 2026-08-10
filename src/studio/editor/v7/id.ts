export type EditorV7IdFactory = (prefix: 'step' | 'element') => string;

let fallbackCounter = 0;

/** Runtime-only IDs. Tests and import adapters should inject their own factory. */
export const generateEditorV7Id: EditorV7IdFactory = (prefix) => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}.${uuid}`;
  fallbackCounter += 1;
  return `${prefix}.${Date.now().toString(36)}.${fallbackCounter.toString(36)}`;
};
