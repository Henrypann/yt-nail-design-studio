/** Backend-neutral immutable preview read model for a fixed DesignVersion share. */
export interface FixedPreviewAssetV1 {
  kind: 'COVER' | 'DETAIL';
  finger?: string;
  assetId: string;
  revision: number;
  sha256: string;
  mimeType: string;
  fidelity: 'EXACT' | 'APPROXIMATE';
  locator: string;
}

export interface FixedPreviewReadModelV1 {
  schemaVersion: 1;
  fidelity: 'EXACT' | 'APPROXIMATE';
  cover: FixedPreviewAssetV1;
  details: FixedPreviewAssetV1[];
}
