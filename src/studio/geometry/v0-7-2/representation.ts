import type {
  GeometryRepresentationFormatV1,
  GeometryRepresentationV1,
  GeometryStableErrorCodeV1,
  NailSurfaceGeometryBundleV1,
} from './model';
import { parseNailSurfaceGeometryBundleV1 } from './schema';

export interface GeometryRepresentationArtifactPortV1 {
  readBytes(path: string): Promise<Uint8Array>;
  sha256(bytes: Uint8Array): Promise<string>;
}

export type VerifiedNailSurfaceGeometryBundleResultV1 =
  | { ok: true; bundle: NailSurfaceGeometryBundleV1 }
  | { ok: false; code: Extract<GeometryStableErrorCodeV1, 'invalid_contract' | 'hash_mismatch'>; path: string };

/**
 * Fail-closed preflight for immutable representation bytes. It intentionally
 * does not promote or register the bundle and never falls back to another mesh.
 */
export async function verifyNailSurfaceGeometryBundleV1(
  input: unknown,
  port: GeometryRepresentationArtifactPortV1,
): Promise<VerifiedNailSurfaceGeometryBundleResultV1> {
  const parsed = parseNailSurfaceGeometryBundleV1(input);
  if (!parsed.ok) return { ok: false, code: 'invalid_contract', path: parsed.issues[0]?.path ?? '$' };
  const bundle = parsed.value;
  for (const [index, representation] of bundle.representationSet.representations.entries()) {
    const path = `$.representationSet.representations[${index}].artifact`;
    let bytes: Uint8Array;
    let digest: string;
    try {
      bytes = await port.readBytes(representation.artifact.path);
      digest = await port.sha256(bytes);
    } catch {
      return { ok: false, code: 'hash_mismatch', path };
    }
    if (bytes.byteLength !== representation.artifact.byteLength || digest !== representation.artifact.sha256) {
      return { ok: false, code: 'hash_mismatch', path };
    }
  }
  return { ok: true, bundle };
}

export function selectGeometryRepresentationV1(
  bundle: NailSurfaceGeometryBundleV1,
  format: GeometryRepresentationFormatV1,
): GeometryRepresentationV1 | null {
  return bundle.representationSet.representations.find((entry) => entry.format === format) ?? null;
}
