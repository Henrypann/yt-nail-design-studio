import { FINGER_CODES } from '@/lib/types';
import type { RecipeInstanceV1 } from '@/studio/editor/lib/recipe-model';
import { mergeMercuryParams } from '@/studio/editor/lib/recipe-model';
import { normalizeBackgroundDirectionV7, parseHexColorV7 } from './background';
import type { EditorDocV7, ProcessStepV7, RegionMaskV7 } from './model';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry';
import { parseEditorDocV7 } from './schema';

const MERCURY_RECIPE_INSTANCE_ID = 'recipe.mercury-dew.signature';

function mask(pathData: string): RegionMaskV7 {
  return { coordinateSpace: 'nail-local-v1', pathData, fillRule: 'nonzero', inverted: false };
}

function ribbonOutline(points: Array<{ u: number; v: number }>, widthMm: number): RegionMaskV7 {
  const half = Math.min(0.05, Math.max(0.012, widthMm / 20));
  const upper = points.map((point) => `${point.u.toFixed(4)} ${(point.v - half).toFixed(4)}`);
  const lower = [...points].reverse().map((point) => `${point.u.toFixed(4)} ${(point.v + half).toFixed(4)}`);
  return mask(`M${upper.join(' L')} L${lower.join(' L')} Z`);
}

function dropletOutline(u: number, v: number, radiusMm: number): RegionMaskV7 {
  const rx = Math.min(0.08, Math.max(0.015, radiusMm / 18));
  const ry = rx * 0.72;
  const k = 0.5522848;
  return mask([
    `M${(u + rx).toFixed(4)} ${v.toFixed(4)}`,
    `C${(u + rx).toFixed(4)} ${(v + k * ry).toFixed(4)} ${(u + k * rx).toFixed(4)} ${(v + ry).toFixed(4)} ${u.toFixed(4)} ${(v + ry).toFixed(4)}`,
    `C${(u - k * rx).toFixed(4)} ${(v + ry).toFixed(4)} ${(u - rx).toFixed(4)} ${(v + k * ry).toFixed(4)} ${(u - rx).toFixed(4)} ${v.toFixed(4)}`,
    `C${(u - rx).toFixed(4)} ${(v - k * ry).toFixed(4)} ${(u - k * rx).toFixed(4)} ${(v - ry).toFixed(4)} ${u.toFixed(4)} ${(v - ry).toFixed(4)}`,
    `C${(u + k * rx).toFixed(4)} ${(v - ry).toFixed(4)} ${(u + rx).toFixed(4)} ${(v - k * ry).toFixed(4)} ${(u + rx).toFixed(4)} ${v.toFixed(4)} Z`,
  ].join(' '));
}

/** Materialize the signed Mercury recipe as V7 process steps; no V6 fallback. */
export function materializeMercuryDewV7(doc: EditorDocV7, recipe: RecipeInstanceV1): EditorDocV7 | null {
  if (recipe.recipeRef.id !== 'mercury-dew') return null;
  const next = structuredClone(doc);
  next.recipeInstances = {
    [MERCURY_RECIPE_INSTANCE_ID]: {
      instanceId: MERCURY_RECIPE_INSTANCE_ID,
      recipeId: recipe.recipeRef.id,
      recipeRevision: recipe.recipeRef.version,
      parameterValues: {
        presetId: recipe.presetId,
        renderer: 'svg-2.5d/mercury-1',
        previewFidelity: 'simulated',
        manufacturingCommandAllowed: false,
      },
    },
  };

  for (const finger of FINGER_CODES) {
    const params = mergeMercuryParams(recipe, finger);
    const color = parseHexColorV7(params.baseColor);
    if (!color) return null;
    const nail = next.nails[finger];
    const finish = nail.steps[nail.steps.length - 1];
    if (finish.kind !== 'surface_finish') return null;
    const token = `${next.designId.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 36)}.${finger}`;
    const decorations: Extract<ProcessStepV7, { kind: 'dimensional_decoration' }>['decorations'] = [{
      id: `decoration.${token}.ribbon`,
      kind: 'relief_2_5d',
      visible: true,
      locked: false,
      transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 },
      heightMm: params.ribbonHeightMm,
      materialRef: { materialId: `material.mercury.ribbon.${params.ribbonMaterial}`, revision: '1' },
      previewFidelity: 'approximate',
      outline: ribbonOutline(params.ribbonAnchors, params.ribbonWidthMm),
    }];
    params.droplets.slice(0, 6).forEach((drop, index) => {
      decorations.push({
        id: `decoration.${token}.droplet-${index + 1}`,
        kind: 'relief_2_5d',
        visible: true,
        locked: false,
        transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 },
        heightMm: Math.min(0.3, Math.max(0.05, drop.heightMm)),
        materialRef: { materialId: 'material.mercury.clear-droplet', revision: '1' },
        previewFidelity: 'approximate',
        outline: dropletOutline(drop.uv.u, drop.uv.v, drop.radiusMm),
      });
    });
    nail.steps = [{
      id: `step.${token}.background`,
      typeId: PROCESS_STEP_TYPE_IDS_V7.background,
      kind: 'background',
      name: 'Mercury 猫眼底色',
      visible: true,
      locked: false,
      skipped: false,
      recipeInstanceId: MERCURY_RECIPE_INSTANCE_ID,
      materialRefs: [{ materialId: 'material.mercury.cat-eye-base', revision: '1' }],
      background: {
        mode: 'cat_eye',
        opacity: params.baseCoverage === 'translucent' ? 0.82 : 1,
        color,
        directionDeg: normalizeBackgroundDirectionV7(params.catEyeAngleDeg),
        intensity: params.beamIntensity === 'soft' ? 0.35 : params.beamIntensity === 'strong' ? 0.82 : 0.58,
        bandWidth: params.beamWidth === 'narrow' ? 0.18 : params.beamWidth === 'wide' ? 0.42 : 0.28,
        previewFidelity: 'approximate',
      },
    }, {
      id: `step.${token}.relief`,
      typeId: PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration,
      kind: 'dimensional_decoration',
      name: 'Mercury 金属丝带与水滴',
      visible: true,
      locked: false,
      skipped: false,
      recipeInstanceId: MERCURY_RECIPE_INSTANCE_ID,
      materialRefs: [
        { materialId: `material.mercury.ribbon.${params.ribbonMaterial}`, revision: '1' },
        { materialId: 'material.mercury.clear-droplet', revision: '1' },
      ],
      decorations,
    }, { ...finish, recipeInstanceId: MERCURY_RECIPE_INSTANCE_ID }];
  }
  const parsed = parseEditorDocV7(next);
  return parsed.ok ? parsed.doc : null;
}
