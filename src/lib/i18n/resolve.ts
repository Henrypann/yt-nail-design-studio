import { CATALOGS } from './messages';
import { formatMessage } from './format';
import type { CanonicalLocale, MessageKey, MessageParams } from './types';

export function resolveMessage(locale: CanonicalLocale, key: MessageKey, params?: MessageParams): string {
  const value = CATALOGS[locale].messages[key] ?? CATALOGS['zh-CN'].messages[key];
  if (!value) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing message key: ${String(key)}`);
    return import.meta.env?.DEV ? `⟦${String(key)}⟧` : String(key);
  }
  return formatMessage(value, params);
}
