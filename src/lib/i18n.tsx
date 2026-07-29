import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'zh' | 'en';

const LOCALE_KEY = 'nail-studio:locale';

interface LocaleValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  text: (zh: string, en: string) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    window.localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'zh',
  );
  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      setLocale: (next) => {
        window.localStorage.setItem(LOCALE_KEY, next);
        document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
        setLocaleState(next);
      },
      text: (zh, en) => (locale === 'zh' ? zh : en),
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div
      className="flex items-center rounded-button border border-gray-200 bg-gray-50 p-0.5"
      role="group"
      aria-label="Language"
      data-testid="language-toggle"
    >
      {(['zh', 'en'] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={locale === item}
          onClick={() => setLocale(item)}
          className={
            locale === item
              ? 'rounded-button bg-white px-2 py-1 text-[11px] font-medium text-primary shadow-sm'
              : 'rounded-button px-2 py-1 text-[11px] text-gray-500 hover:text-gray-800'
          }
        >
          {item === 'zh' ? '中文' : 'EN'}
        </button>
      ))}
    </div>
  );
}
