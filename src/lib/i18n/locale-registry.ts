export const LOCALE_REGISTRY = [
  { canonical: 'zh-CN', aliases: ['zh'] as const, displayName: '中文（简体）', displayKey: 'app.language.zh' },
  { canonical: 'en-US', aliases: ['en'] as const, displayName: 'English (US)', displayKey: 'app.language.en' },
] as const;

export type LocaleDefinition = (typeof LOCALE_REGISTRY)[number];
export type CanonicalLocale = LocaleDefinition['canonical'];
export type LegacyLocale = LocaleDefinition['aliases'][number];
export const DEFAULT_LOCALE: CanonicalLocale = 'zh-CN';
export const SUPPORTED_LOCALES = LOCALE_REGISTRY.map(({ canonical }) => canonical) as CanonicalLocale[];

const aliasToCanonical = new Map<string, CanonicalLocale>(
  LOCALE_REGISTRY.flatMap(({ canonical, aliases }) => [canonical, ...aliases].map((value) => [value, canonical] as const)),
);

export function canonicalizeLocale(value: string | null | undefined): CanonicalLocale {
  return aliasToCanonical.get(value ?? '') ?? DEFAULT_LOCALE;
}
