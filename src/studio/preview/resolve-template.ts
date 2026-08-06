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
