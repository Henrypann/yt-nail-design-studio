import { LOCALE_REGISTRY, toLocale, type CatalogEntryKey, type LegacyLocale, type Locale, type MessageCatalogBundleCreateInputV1, type MessageCatalogBundleUpdateInputV1, type MessageCatalogEntryV1, type MessageCatalogRepositoryV1 } from './types';

const placeholders = (value: string) => [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
function validateBundle(key: string, values: Record<string, string>): void {
  const locales = LOCALE_REGISTRY.map(({ canonical }) => canonical);
  if (Object.keys(values).sort().join('|') !== locales.slice().sort().join('|')) throw new Error(`bundle locale completeness failure: ${key}`);
  if (new Set(Object.keys(values)).size !== locales.length) throw new Error(`bundle locale uniqueness failure: ${key}`);
  const expected = placeholders(values[locales[0]]);
  for (const locale of locales.slice(1)) if (JSON.stringify(placeholders(values[locale])) !== JSON.stringify(expected)) throw new Error(`bundle placeholder parity failure: ${key}:${locale}`);
}

export class InMemoryMessageCatalogRepositoryV1 implements MessageCatalogRepositoryV1 {
  private readonly entries = new Map<string, MessageCatalogEntryV1>();
  constructor(seed: MessageCatalogEntryV1[] = []) {
    seed.forEach((entry) => {
      const locale = toLocale(entry.locale);
      const id = this.id(locale, entry.key);
      if (this.entries.has(id)) throw new Error(`duplicate canonical message seed: ${id}`);
      this.entries.set(id, { ...entry, locale });
    });
  }
  private id(locale: Locale | LegacyLocale, key: CatalogEntryKey) { return `${toLocale(locale)}:${key}`; }
  async list(locale: Locale | LegacyLocale, options?: { includeArchived?: boolean }) { const canonical = toLocale(locale); return [...this.entries.values()].filter((entry) => entry.locale === canonical && (options?.includeArchived || entry.status === 'active')).sort((a, b) => a.key.localeCompare(b.key)); }
  async get(locale: Locale | LegacyLocale, key: CatalogEntryKey, options?: { includeArchived?: boolean }) { const entry = this.entries.get(this.id(locale, key)); return entry && (options?.includeArchived || entry.status === 'active') ? { ...entry } : null; }
  async create(input: Omit<MessageCatalogEntryV1, 'revision' | 'status' | 'createdAt' | 'updatedAt'> & { expectedRevision?: number }) {
    if (input.expectedRevision !== undefined && input.expectedRevision !== 0) throw new Error(`revision conflict: create expectedRevision must be undefined or 0, actual ${input.expectedRevision}`);
    const id = this.id(input.locale, input.key); if (this.entries.has(id)) throw new Error(`message already exists: ${id}`);
    const now = new Date().toISOString(); const entry: MessageCatalogEntryV1 = { ...input, locale: toLocale(input.locale), revision: 1, status: 'active', createdAt: now, updatedAt: now }; this.entries.set(id, entry); return { ...entry };
  }
  async createBundle(input: MessageCatalogBundleCreateInputV1) {
    validateBundle(input.key, input.values);
    for (const { canonical } of LOCALE_REGISTRY) {
      if (input.expectedRevisions?.[canonical] !== undefined && input.expectedRevisions[canonical] !== 0) throw new Error(`revision conflict: bundle create ${canonical}`);
      if (this.entries.has(this.id(canonical, input.key))) throw new Error(`message already exists: ${canonical}:${input.key}`);
    }
    const now = new Date().toISOString();
    const created = LOCALE_REGISTRY.map(({ canonical }) => ({ key: input.key, locale: canonical, value: input.values[canonical], revision: 1, status: 'active' as const, createdAt: now, updatedAt: now, createdBy: input.actor, updatedBy: input.actor }));
    created.forEach((entry) => this.entries.set(this.id(entry.locale, entry.key), entry));
    return created.map((entry) => ({ ...entry }));
  }
  async updateBundle(input: MessageCatalogBundleUpdateInputV1) {
    validateBundle(input.key, input.values);
    const current = LOCALE_REGISTRY.map(({ canonical }) => this.entries.get(this.id(canonical, input.key)));
    if (current.some((entry) => !entry)) throw new Error(`bundle update missing locale: ${input.key}`);
    for (const entry of current) if (entry && entry.revision !== input.expectedRevisions[entry.locale]) throw new Error(`revision conflict: bundle ${entry.locale}:${input.key}`);
    const now = new Date().toISOString();
    const updated = current.map((entry) => ({ ...entry!, value: input.values[entry!.locale], status: 'active' as const, revision: entry!.revision + 1, updatedAt: now, updatedBy: input.actor }));
    updated.forEach((entry) => this.entries.set(this.id(entry.locale, entry.key), entry));
    return updated.map((entry) => ({ ...entry }));
  }
  async update(locale: Locale | LegacyLocale, key: CatalogEntryKey, value: string, actor: string, expectedRevision: number) { return this.mutate(locale, key, actor, expectedRevision, { value, status: 'active' }); }
  async archive(locale: Locale | LegacyLocale, key: string, actor: string, expectedRevision: number) { return this.mutate(locale, key, actor, expectedRevision, { status: 'archived' }); }
  private mutate(locale: Locale | LegacyLocale, key: string, actor: string, expectedRevision: number, patch: Partial<MessageCatalogEntryV1>) { const current = this.entries.get(this.id(locale, key)); if (!current) throw new Error(`message not found: ${locale}:${key}`); if (current.revision !== expectedRevision) throw new Error(`revision conflict: expected ${expectedRevision}, actual ${current.revision}`); const next = { ...current, ...patch, revision: current.revision + 1, updatedAt: new Date().toISOString(), updatedBy: actor }; this.entries.set(this.id(locale, key), next); return Promise.resolve({ ...next }); }
}
