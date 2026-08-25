import { toLegacyLocale, type LegacyLocale, type Locale } from './types';
/** Domain registries own these labels; this adapter deliberately does not create catalog keys. */
export function localizedLabel(zh: string, en: string, locale: Locale | LegacyLocale = 'zh-CN'): string { return toLegacyLocale(locale) === 'zh' ? zh : en; }
