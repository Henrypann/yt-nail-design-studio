import { toLocale, type CanonicalLocale, type Locale, type LegacyLocale } from './types';

export const LOCALE_STORAGE_KEY = 'nail-studio:locale';

/** Normalize persisted locale values, including the pre-v0.7.2 zh/en aliases. */
export function readCanonicalLocale(value: string | null | undefined): CanonicalLocale {
  return toLocale(value);
}

/** Persist only canonical locale identifiers; aliases remain read-compatible. */
export function persistCanonicalLocale(locale: Locale | LegacyLocale, storage?: Pick<Storage, 'setItem'>): CanonicalLocale {
  const canonical = toLocale(locale);
  storage?.setItem(LOCALE_STORAGE_KEY, canonical);
  return canonical;
}

export function syncDocumentLocale(locale: CanonicalLocale, documentLike?: Pick<Document, 'documentElement'>): void {
  if (documentLike) documentLike.documentElement.lang = locale;
}
