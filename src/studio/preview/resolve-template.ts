/**
 * Template ID single resolution path (PR-05).
 * manifest recommendation → material-library actual render ID.
 */

import type { StyleRecommendation } from '@/studio/wizard/StyleRecommendModal';
import type { LibraryIndex, TemplateEntry } from './material-library';

/** Wizard writes templateId: SIMULATED HQ uses own id, other CONCEPT still degrades to render_template_id. */
export function resolveEffectiveTemplateId(template: TemplateEntry): string {
  return template.render_template_id ?? template.id;
}

/** manifest recommendation → library entry + effective templateId; null when template_id missing or not in library. */
export function resolveStyleRecommendation(
  style: StyleRecommendation,
  index: LibraryIndex,
): { entry: TemplateEntry; effectiveId: string } | null {
  if (!style.template_id) return null;
  const entry = index.templates.find((t) => t.id === style.template_id);
  if (!entry) return null;
  return { entry, effectiveId: resolveEffectiveTemplateId(entry) };
}

/** Recommendations with missing application targets never reach the selection UI. */
export function filterResolvableStyleRecommendations(
  styles: readonly StyleRecommendation[],
  index: LibraryIndex,
): StyleRecommendation[] {
  return styles.filter((style) => resolveStyleRecommendation(style, index) !== null);
}

export type StyleApplicationResult =
  | { status: 'ok'; entry: TemplateEntry; effectiveId: string }
  | { status: 'missing_template' | 'load_failed' | 'enter_failed' };

/**
 * Single Wizard selection transaction boundary. Style/template mutations are
 * deliberately last, after both asset validation and the Step 1 transition.
 */
export async function applyValidatedStyleRecommendation(
  style: StyleRecommendation,
  deps: {
    loadIndex: () => Promise<LibraryIndex>;
    applyAndEnter: () => Promise<boolean>;
    setStyle: (id: string, name: string) => void;
    applyTemplate: (entry: TemplateEntry) => void;
  },
): Promise<StyleApplicationResult> {
  let index: LibraryIndex;
  try {
    index = await deps.loadIndex();
  } catch {
    return { status: 'load_failed' };
  }
  const resolved = resolveStyleRecommendation(style, index);
  if (!resolved) return { status: 'missing_template' };
  if (!await deps.applyAndEnter()) return { status: 'enter_failed' };
  deps.setStyle(style.id, style.name);
  deps.applyTemplate(resolved.entry);
  return { status: 'ok', ...resolved };
}
