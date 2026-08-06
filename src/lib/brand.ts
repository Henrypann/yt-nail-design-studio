/**
 * Brand rename configuration (PR-09).
 * Single source of truth for the product display name.
 * Schema identifiers, storage keys, route paths, and package names are NOT affected.
 *
 * To activate a rename:
 * 1. Set BRAND_NAME to the new name
 * 2. Run integration regression to verify no deep links or stored data break
 * 3. Get product owner approval
 */

export const BRAND_NAME = 'Nail Style Studio';

/** Chinese display name. */
export const BRAND_NAME_ZH = '美甲风格工作室';

/** Short name for compact UI (e.g., nav bar). */
export const BRAND_SHORT_NAME = 'Nail Style';

/** Tagline for landing/splash. */
export const BRAND_TAGLINE = 'Professional Nail Design Studio';

/** Get brand name for the current locale. */
export function getBrandName(locale: 'en' | 'zh' = 'zh'): string {
  return locale === 'en' ? BRAND_NAME : BRAND_NAME_ZH;
}
