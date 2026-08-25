import { canonicalizeLocale, LOCALE_REGISTRY, type CanonicalLocale, type LegacyLocale } from './locale-registry';
export { canonicalizeLocale, DEFAULT_LOCALE, LOCALE_REGISTRY, SUPPORTED_LOCALES } from './locale-registry';
export type { CanonicalLocale, LegacyLocale } from './locale-registry';
export type Locale = CanonicalLocale;
import type { ZH_CN_MESSAGES } from './messages';
export type MessageKey = keyof typeof ZH_CN_MESSAGES;
export type CatalogEntryKey = string;
export type MessageParams = Record<string, string | number>;

export interface MessageCatalogV1 {
  schemaVersion: 1;
  locale: CanonicalLocale;
  revision: number;
  messages: Record<MessageKey, string>;
}

export interface MessageCatalogEntryV1 {
  key: CatalogEntryKey;
  locale: CanonicalLocale;
  value: string;
  revision: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface MessageCatalogRepositoryV1 {
  list(locale: Locale | LegacyLocale, options?: { includeArchived?: boolean }): Promise<MessageCatalogEntryV1[]>;
  get(locale: Locale | LegacyLocale, key: CatalogEntryKey, options?: { includeArchived?: boolean }): Promise<MessageCatalogEntryV1 | null>;
  create(input: Omit<MessageCatalogEntryV1, 'revision' | 'status' | 'createdAt' | 'updatedAt'> & { expectedRevision?: number }): Promise<MessageCatalogEntryV1>;
  update(locale: Locale | LegacyLocale, key: CatalogEntryKey, value: string, actor: string, expectedRevision: number): Promise<MessageCatalogEntryV1>;
  archive(locale: Locale | LegacyLocale, key: CatalogEntryKey, actor: string, expectedRevision: number): Promise<MessageCatalogEntryV1>;
  createBundle(input: MessageCatalogBundleCreateInputV1): Promise<MessageCatalogEntryV1[]>;
  updateBundle(input: MessageCatalogBundleUpdateInputV1): Promise<MessageCatalogEntryV1[]>;
}

export function toLocale(value: string | null | undefined): CanonicalLocale {
  return canonicalizeLocale(value);
}

export function toLegacyLocale(locale: Locale | LegacyLocale): LegacyLocale {
  return LOCALE_REGISTRY.find(({ canonical }) => canonical === toLocale(locale))?.aliases[0] ?? 'zh';
}

export type LocaleValuesV1 = Record<CanonicalLocale, string>;
export type LocaleRevisionsV1 = Partial<Record<CanonicalLocale, number>>;
export interface MessageCatalogBundleCreateInputV1 {
  key: CatalogEntryKey;
  values: LocaleValuesV1;
  actor: string;
  expectedRevisions?: LocaleRevisionsV1;
}
export interface MessageCatalogBundleUpdateInputV1 extends MessageCatalogBundleCreateInputV1 {
  expectedRevisions: Record<CanonicalLocale, number>;
}
