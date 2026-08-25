import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveMessage } from './i18n/resolve';
import { toLegacyLocale, type CanonicalLocale, type LegacyLocale, type Locale, type MessageKey, type MessageParams } from './i18n/types';
import { LOCALE_STORAGE_KEY, persistCanonicalLocale, readCanonicalLocale, syncDocumentLocale } from './i18n/locale';
import { LOCALE_REGISTRY } from './i18n/locale-registry';
export type { Locale, CanonicalLocale, LegacyLocale, MessageKey, MessageParams } from './i18n/types';
export { CATALOGS } from './i18n/messages';
export { InMemoryMessageCatalogRepositoryV1 } from './i18n/repository';
export * from './i18n/types';
export * from './i18n/locale';
export { formatMessage } from './i18n/format';
export { resolveMessage } from './i18n/resolve';
export { localizedLabel } from './i18n/localize';

interface LocaleValue {
  locale: CanonicalLocale;
  legacyLocale: LegacyLocale;
  setLocale: (locale: Locale | LegacyLocale) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<CanonicalLocale>(() =>
    readCanonicalLocale(typeof window === 'undefined' ? null : window.localStorage.getItem(LOCALE_STORAGE_KEY)),
  );
  const legacyLocale = toLegacyLocale(locale);
  const setLocale = (next: Locale | LegacyLocale) => {
    setLocaleState(persistCanonicalLocale(next, window.localStorage));
  };

  useEffect(() => {
    persistCanonicalLocale(locale, window.localStorage);
    syncDocumentLocale(locale, document);
  }, [locale]);

  const value = useMemo<LocaleValue>(
    () => ({ locale, legacyLocale, setLocale, t: (key, params) => resolveMessage(locale, key, params) }),
    [locale, legacyLocale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="flex items-center rounded-button border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label={t('common.language')} data-testid="language-toggle">
      {LOCALE_REGISTRY.map((item) => (
        <button
          key={item.canonical}
          type="button"
          aria-pressed={locale === item.canonical}
          onClick={() => setLocale(item.canonical)}
          className={locale === item.canonical
            ? 'rounded-button bg-white px-2 py-1 text-[11px] font-medium text-primary shadow-sm'
            : 'rounded-button px-2 py-1 text-[11px] text-gray-500 hover:text-gray-800'}
        >
          {t(item.displayKey)}
        </button>
      ))}
    </div>
  );
}
