/**
 * Studio V7.1 · STUDIO-V7.1-03 PublishPackageV1 — model types and constants.
 *
 * A release package is a deterministic, publish-safe derivation from an
 * immutable DesignVersionV1 plus its private DesignReleaseRecordV1. It carries
 * a ten-finger cover, per-nail detail descriptors, palette, shape/length
 * summaries, per-output fidelity/fallback evidence and an immutable source
 * manifest. It never embeds the EditorDocV7, customer/private data,
 * manufacturing definitions, device parameters or runtime store state.
 *
 * Every derived output is an immutable asset ref: kind + finger (where
 * relevant), its own immutable revision, SHA-256, mime, dimensions, color space,
 * fidelity and an explicit fallback reason when the 2D fallback path was used.
 * Fidelity is exactly EXACT | APPROXIMATE — never a manufacturing claim.
 * Marketing concept images are forbidden: the package only references derived
 * outputs by content-addressed id/SHA-256; it never embeds image bytes or concept art.
 *
 * Generation is pure: renderer, SHA-256, content-addressed asset-id and geometry registry are
 * injected dependencies. All outputs are generated under one fixed renderer
 * revision and a fixed source DesignVersion, so a retry with the same
 * dependencies reproduces the same semantic package without mutating or
 * rewriting the DesignVersion.
 */

import { FINGER_CODES, type FingerCode } from '@/lib/types';
import type { DesignVersionV1 } from '@/community/domain/v7_1/design-content-model';
import type {
  EditorDocV7,
  NailDesignV7,
  RgbaColorV7,
  SurfaceFinishTypeV7,
} from '@/studio/editor/v7/model';
import type {
  DesignReleaseManifestV1,
  ReleasedCompositionProvenanceV1,
  ReleasedGeometryRefV1,
  ReleasedMaterialRefV1,
  ReleasedRecipeRefV1,
} from '@/studio/versioning/design-release';
import type { DesignSourceRefV1 } from '@/studio/editor/v7/model';

export const PUBLISH_PACKAGE_SCHEMA_VERSION = 1 as const;

export const PUBLISH_OUTPUT_KINDS_V1 = ['COVER', 'DETAIL'] as const;
export type PublishOutputKindV1 = (typeof PUBLISH_OUTPUT_KINDS_V1)[number];

/** Derived-output fidelity: EXACT vs APPROXIMATE. Never a manufacturing claim. */
export const PUBLISH_FIDELITIES_V1 = ['EXACT', 'APPROXIMATE'] as const;
export type PublishFidelityV1 = (typeof PUBLISH_FIDELITIES_V1)[number];

export const PUBLISH_FALLBACK_REASONS_V1 = [
  'PRIMARY_RENDERER_UNAVAILABLE',
  'PRIMARY_RENDERER_REJECTED',
  'PRIMARY_RENDERER_OUTPUT_INVALID',
  'PRIMARY_RENDERER_EXCEPTION',
  'PRIMARY_RENDERER_APPROXIMATE',
] as const;
export type PublishFallbackReasonV1 = (typeof PUBLISH_FALLBACK_REASONS_V1)[number];

export const PUBLISH_COLOR_SPACES_V1 = ['srgb', 'display-p3'] as const;
export type PublishColorSpaceV1 = (typeof PUBLISH_COLOR_SPACES_V1)[number];

export const PUBLISH_OUTPUT_MIME_V1 = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type PublishOutputMimeV1 = (typeof PUBLISH_OUTPUT_MIME_V1)[number];

/** Requested canvas sizes for derived outputs (renderers may report actuals). */
export const PUBLISH_COVER_SIZE = { width: 1024, height: 1024 } as const;
export const PUBLISH_DETAIL_SIZE = { width: 512, height: 512 } as const;

/**
 * Immutable derived output ref. `sourceDesignVersionId` / `sourceVersion` /
 * `sourceRevision` pin the exact released DesignVersion this output derives
 * from; `rendererRevision` is the fixed renderer contract revision the whole
 * package was generated under; `rendererId` names the renderer that actually
 * produced the output (primary 3D renderer or the 2D fallback).
 */
export interface PublishPackageOutputV1 {
  kind: PublishOutputKindV1;
  /** DETAIL outputs only; a COVER output must never carry a finger. */
  finger?: FingerCode;
  assetId: string;
  /** Immutable revision of this derived asset (1 for a first generated revision). */
  revision: number;
  /** SHA-256 hex digest of the derived output bytes. */
  sha256: string;
  mimeType: PublishOutputMimeV1;
  width: number;
  height: number;
  colorSpace: PublishColorSpaceV1;
  fidelity: PublishFidelityV1;
  /** Present exactly when the 2D fallback renderer produced this output. */
  fallbackReason?: PublishFallbackReasonV1;
  rendererId: string;
  rendererRevision: string;
  sourceDesignVersionId: string;
  sourceVersion: number;
  sourceRevision: number;
}

/** Per-nail descriptor: finish type, its DETAIL asset and output fidelity. */
export interface NailDetailDescriptorV1 {
  finger: FingerCode;
  finishType: SurfaceFinishTypeV7;
  detailAssetId: string;
  fidelity: PublishFidelityV1;
}

/**
 * Per-finger geometry summary. Shape/length are resolved by an injected
 * asset-registry resolver — never inferred from string IDs. An unresolved
 * geometry entry is explicit (status + reason) and never fails the package.
 */
export interface PublishPackageGeometryV1 {
  finger: FingerCode;
  assetId: string;
  revision: string;
  status: 'resolved' | 'unresolved';
  shapeId?: string;
  lengthId?: string;
  reason?: string;
}

export type GeometryResolutionV1 =
  | { status: 'resolved'; shapeId: string; lengthId: string }
  | { status: 'unresolved'; reason: string };

/**
 * Immutable source manifest: every geometry/asset/material/recipe/source ref
 * of the released design, copied from the private DesignReleaseRecordV1
 * manifest. The EditorDocV7 itself is never embedded.
 */
export interface PublishPackageManifestV1 extends DesignReleaseManifestV1 {
  schemaVersion: 1;
  geometryRefs: ReleasedGeometryRefV1[];
  materialRevisionRefs: ReleasedMaterialRefV1[];
  recipeRevisionRefs: ReleasedRecipeRefV1[];
  sourceRefs: DesignSourceRefV1[];
  compositionProvenance: ReleasedCompositionProvenanceV1[];
}

/** Strict typed/versioned release package. */
export interface PublishPackageV1 {
  schemaVersion: 1;
  packageId: string;
  /** Immutable released version this package derives from. */
  designVersionId: string;
  designId: string;
  /** DesignVersion.version (release sequence). */
  version: number;
  /** DesignVersion.revision (released EditorDoc revision). */
  revision: number;
  /** Fixed renderer contract revision the package was generated under. */
  rendererRevision: string;
  generatedAt: string;
  /** EXACT only when every derived output is EXACT; otherwise APPROXIMATE. */
  fidelity: PublishFidelityV1;
  cover: PublishPackageOutputV1;
  /** Ten per-nail DETAIL outputs in canonical finger order. */
  details: PublishPackageOutputV1[];
  nailDescriptors: NailDetailDescriptorV1[];
  /** Stable normalized/deduped/sorted palette derived from canonical RGBA content. */
  palette: string[];
  /** Sorted/deduped shape ids resolved by the injected geometry registry. */
  shapeIds: string[];
  /** Sorted/deduped length ids resolved by the injected geometry registry. */
  lengthIds: string[];
  geometry: PublishPackageGeometryV1[];
  assetManifest: PublishPackageManifestV1;
}

// ---------------------------------------------------------------------------
// Renderer boundary (injected dependencies)
// ---------------------------------------------------------------------------

export interface PublishRenderRequestV1 {
  kind: PublishOutputKindV1;
  /** DETAIL only. */
  finger?: FingerCode;
  /** Requested output canvas size (renderers may report actuals). */
  width: number;
  height: number;
  /** Immutable released version the render derives from. */
  designVersion: DesignVersionV1;
  /** The immutable EditorDocV7 snapshot; never serialized into the package. */
  doc: EditorDocV7;
  /** The nail to render for a DETAIL request. */
  nail?: NailDesignV7;
  /** Stable derived palette, available to renderers that use it. */
  palette: string[];
}

export interface PublishRendererOutputV1 {
  /** Exact rendered image bytes (hashed into the output ref, never embedded). */
  bytes: Uint8Array;
  mimeType: PublishOutputMimeV1;
  width: number;
  height: number;
  colorSpace: PublishColorSpaceV1;
  fidelity: PublishFidelityV1;
}

export type PublishRenderResultV1 =
  | { ok: true; output: PublishRendererOutputV1 }
  | { ok: false; reason: string };

export interface PublishRendererV1 {
  rendererId: string;
  /** May be async (e.g. a WebGL renderer); failures fall back to renderer2d. */
  render(request: PublishRenderRequestV1): PublishRenderResultV1 | Promise<PublishRenderResultV1>;
}

// ---------------------------------------------------------------------------
// Generation dependencies and results
// ---------------------------------------------------------------------------

export interface PublishPackageDependenciesV1 {
  /** Fixed renderer contract revision stamped on the package and every output. */
  rendererRevision: string;
  /** Primary 3D renderer; null means 3D/WebGL/mesh is unavailable. */
  renderer3d: PublishRendererV1 | null;
  /** Always-available 2D fallback renderer; failures here fail the package. */
  renderer2d: PublishRendererV1;
  /** SHA-256 of the exact rendered bytes (hex digest). */
  sha256(bytes: Uint8Array): Promise<string>;
  /** Content-addressed derived-asset id provider. */
  nextAssetId(kind: PublishOutputKindV1 | 'PACKAGE', finger: FingerCode | null, contentSha256: string): string;
  /** Product-truth geometry registry: shape/length are never read from string IDs. */
  resolveGeometry(ref: { assetId: string; revision: string }): GeometryResolutionV1;
}

export type PublishPackageErrorCodeV1 =
  | 'invalid_release_record'
  | 'dependency_unavailable'
  | 'renderer_failed'
  | 'output_contract_failed';

export type PublishPackageResultV1 =
  | { ok: true; package: PublishPackageV1; fallbackUsed: boolean }
  | { ok: false; code: PublishPackageErrorCodeV1; message: string };

/** Deterministic id provider: ids are pure functions of output/package content. */
export function createDeterministicPublishIdFactoryV1(
): (kind: PublishOutputKindV1 | 'PACKAGE', finger: FingerCode | null, contentSha256: string) => string {
  return (kind, finger, contentSha256) => {
    const scope = kind === 'PACKAGE' ? 'package' : kind === 'COVER' ? 'cover' : `detail.${finger ?? 'unknown'}`;
    return `pub.${scope}.${contentSha256}`;
  };
}

/**
 * Collect every canonical srgb RGBA color of a design in deterministic
 * document order, normalize to lowercase `#rrggbb` (opaque) or `#rrggbbaa`
 * (translucent), dedupe and sort ascending. Skipped or hidden steps do not
 * contribute (they are not rendered). Malformed colors are ignored.
 */
export function deriveStablePaletteV1(doc: EditorDocV7): string[] {
  const colors: string[] = [];
  const pushColor = (color: RgbaColorV7 | undefined): void => {
    if (!color || color.colorSpace !== 'srgb') return;
    const { r, g, b, a } = color;
    if (![r, g, b, a].every((value) => typeof value === 'number' && Number.isFinite(value))) return;
    const byte = (value: number): string => Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0');
    const alpha = byte(a * 255);
    colors.push(alpha === 'ff' ? `#${byte(r)}${byte(g)}${byte(b)}` : `#${byte(r)}${byte(g)}${byte(b)}${alpha}`);
  };
  for (const finger of FINGER_CODES) {
    const nail = doc.nails[finger];
    if (!nail) continue;
    for (const step of nail.steps) {
      if (step.skipped || !step.visible) continue;
      if (step.kind === 'background') {
        const background = step.background;
        if (background.mode === 'solid' || background.mode === 'translucent' || background.mode === 'cat_eye') {
          pushColor(background.color);
        } else if (background.mode === 'gradient') {
          background.stops.forEach((stop) => pushColor(stop.color));
        } else if (background.mode === 'glitter') {
          background.colors.forEach(pushColor);
        }
      } else if (step.kind === 'flat_design') {
        for (const element of step.elements) {
          if (!element.visible) continue;
          if (element.kind === 'brush_stroke') pushColor(element.color);
          else if (element.kind === 'vector_shape') { pushColor(element.fill); pushColor(element.stroke); }
          else if (element.kind === 'text') pushColor(element.color);
          else if (element.kind === 'french_edge') pushColor(element.color);
        }
      } else if (step.kind === 'surface_effect') {
        if (step.effect.effectType === 'mirror') pushColor(step.effect.tint);
        else if (step.effect.effectType === 'ink_bloom') step.effect.colors.forEach(pushColor);
      }
    }
  }
  return [...new Set(colors)].sort();
}
