import type { NailLength, NailShape } from '@/lib/types';

export type CompatibilitySeverity = 'recommended' | 'neutral' | 'caution' | 'strong';
export type CompatibilityLengthPreset = 'natural' | 'short-extension' | 'medium' | 'long';

interface LocalizedCopy {
  zh: string;
  en: string;
}

interface WarningRule {
  severity: Exclude<CompatibilitySeverity, 'recommended' | 'neutral'>;
  reason: LocalizedCopy;
  suggestion?: LocalizedCopy;
  review_status?: string;
}

interface ShapeLengthRule {
  shape_id: NailShape;
  recommended: CompatibilityLengthPreset[];
  warning: Partial<Record<CompatibilityLengthPreset, WarningRule>>;
}

interface CompatibilityRulesFile {
  shape_length: ShapeLengthRule[];
}

export interface ShapeLengthCompatibility {
  severity: CompatibilitySeverity;
  selectable: true;
  reason?: LocalizedCopy;
  suggestion?: LocalizedCopy;
}

const rawFiles = import.meta.glob(
  '../../material-library/taxonomy/compatibility-rules.json',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const rawCompatibility = Object.values(rawFiles)[0];
const compatibilityRules: CompatibilityRulesFile = rawCompatibility
  ? (JSON.parse(rawCompatibility) as CompatibilityRulesFile)
  : { shape_length: [] };

export const LENGTH_PRESET_BY_GEOMETRY: Record<NailLength, CompatibilityLengthPreset> = {
  short: 'natural',
  medium: 'short-extension',
  long: 'medium',
  'extra-long': 'long',
};

export function getShapeLengthCompatibility(
  shape: NailShape,
  geometryLength: NailLength,
): ShapeLengthCompatibility {
  const preset = LENGTH_PRESET_BY_GEOMETRY[geometryLength];
  const rule = compatibilityRules.shape_length.find((item) => item.shape_id === shape);
  if (!rule) return { severity: 'neutral', selectable: true };
  if (rule.recommended.includes(preset)) {
    return { severity: 'recommended', selectable: true };
  }
  const warning = rule.warning[preset];
  if (warning) {
    return {
      severity: warning.severity,
      selectable: true,
      reason: warning.reason,
      suggestion: warning.suggestion,
    };
  }
  return { severity: 'neutral', selectable: true };
}

export function compatibilityTitle(
  result: ShapeLengthCompatibility,
  locale: 'zh' | 'en',
): string {
  if (result.severity === 'recommended') {
    return locale === 'zh' ? '推荐组合，可自由修改' : 'Recommended combination; you can still change it';
  }
  const reason = result.reason?.[locale];
  const suggestion = result.suggestion?.[locale];
  return [reason, suggestion].filter(Boolean).join(' ');
}

export function compatibilityLabel(
  result: ShapeLengthCompatibility,
  locale: 'zh' | 'en',
): string | null {
  if (result.severity === 'recommended') return locale === 'zh' ? '推荐' : 'Best fit';
  if (result.severity === 'caution') return locale === 'zh' ? '需留意' : 'Caution';
  if (result.severity === 'strong') return locale === 'zh' ? '不建议' : 'Not ideal';
  return null;
}

export function compatibilityToneClass(
  result: ShapeLengthCompatibility,
  selected: boolean,
): string {
  if (selected) return '';
  if (result.severity === 'recommended') {
    return 'border-success/40 bg-success-soft text-success';
  }
  if (result.severity === 'caution') {
    return 'border-warning/40 bg-warning-soft text-warning';
  }
  if (result.severity === 'strong') {
    return 'border-gray-300 bg-gray-100 text-gray-500';
  }
  return '';
}
