import type { AssetRefV7 } from '@/studio/editor/v7/model';
import { dimensionalMeshAssetV7 } from '@/studio/editor/v7/dimensional-decoration';
import { selectLod } from '@/studio/preview/asset-manifest';

export type DimensionalGlbResolutionV072 =
  | { ok: true; url: string; sha256: string; revision: string }
  | {
      ok: false;
      reason:
        | 'invalid_asset_contract'
        | 'manifest_entry_missing'
        | 'manifest_lod_missing'
        | 'immutable_asset_mismatch';
    };

/** Resolve only the exact immutable mesh revision frozen in EditorDocV7. */
export function resolveDimensionalGlbSourceV072(asset: AssetRefV7): DimensionalGlbResolutionV072 {
  if (asset.kind !== 'mesh' || asset.mimeType !== 'model/gltf-binary') {
    return { ok: false, reason: 'invalid_asset_contract' };
  }
  const entry = dimensionalMeshAssetV7(asset.assetId);
  if (!entry) return { ok: false, reason: 'manifest_entry_missing' };
  const lod = selectLod(entry, Number.MAX_SAFE_INTEGER);
  if (!lod) return { ok: false, reason: 'manifest_lod_missing' };
  if (entry.revision !== asset.revision || lod.sha256 !== asset.sha256) {
    return { ok: false, reason: 'immutable_asset_mismatch' };
  }
  return { ok: true, url: lod.path, sha256: asset.sha256, revision: asset.revision };
}
