/**
 * 3D asset manifest types (PR-06).
 * Vendor-neutral manifest schema for GLB shell and component assets.
 */

/** Raw GLB file for production; web GLB for browser preview. */
export interface GlbAssetVariant {
  /** Absolute path or URL to the GLB file. */
  path: string;
  /** File size in bytes (for integrity check). */
  sizeBytes?: number;
  /** SHA-256 hash for integrity verification. */
  sha256?: string;
}

/** A single 3D component (shell, ribbon, droplet, stud, etc.). */
export interface ComponentManifestEntry {
  /** Unique component ID (e.g., 'mercury-dew-shell-almond-medium'). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Component category. */
  category: 'shell' | 'ribbon' | 'droplet' | 'stud' | 'pearl' | 'custom';
  /** Associated nail shape (for shells). */
  shape?: string;
  /** Associated nail length (for shells). */
  length?: string;
  /** GLB variants: raw for manufacturing, web for browser. */
  glb: {
    raw?: GlbAssetVariant;
    web?: GlbAssetVariant;
  };
  /** Coordinate system contract (mm, origin at nail root center). */
  coordinateContract?: {
    unit: 'mm';
    origin: 'nail_root_center';
    tipDirection: 'negative_y';
  };
  /** Renderer readiness status. */
  status: 'REAL' | 'SIMULATED' | 'MOCK' | 'MISSING';
  /** Notes for SIMULATED/MOCK status. */
  statusNote?: string;
}

/** Top-level manifest for a recipe's 3D assets. */
export interface AssetManifestV1 {
  version: 1;
  updatedAt: string;
  recipeId: string;
  components: ComponentManifestEntry[];
}

/**
 * Validate a component manifest entry.
 * Returns null if valid, or an error message.
 */
export function validateComponentEntry(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return 'entry must be an object';
  const e = entry as Record<string, unknown>;
  if (typeof e.id !== 'string' || !e.id) return 'id required';
  if (typeof e.name !== 'string' || !e.name) return 'name required';
  const validCategories = ['shell', 'ribbon', 'droplet', 'stud', 'pearl', 'custom'];
  if (!validCategories.includes(String(e.category))) return `category must be one of: ${validCategories.join(', ')}`;
  const validStatuses = ['REAL', 'SIMULATED', 'MOCK', 'MISSING'];
  if (!validStatuses.includes(String(e.status))) return `status must be one of: ${validStatuses.join(', ')}`;

  const glb = e.glb as Record<string, unknown> | undefined;
  if (!glb || typeof glb !== 'object') return 'glb required';
  if (!glb.raw && !glb.web) return 'at least one glb variant (raw or web) required';

  return null;
}

/**
 * Validate a full asset manifest.
 * Returns { ok: true } or { ok: false, errors: [...] }.
 */
export function validateAssetManifest(manifest: unknown): { ok: true } | { ok: false; errors: string[] } {
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest must be an object'] };
  const m = manifest as Record<string, unknown>;
  if (m.version !== 1) return { ok: false, errors: ['version must be 1'] };
  if (typeof m.recipeId !== 'string' || !m.recipeId) return { ok: false, errors: ['recipeId required'] };
  if (!Array.isArray(m.components)) return { ok: false, errors: ['components must be an array'] };

  const errors: string[] = [];
  for (let i = 0; i < m.components.length; i++) {
    const err = validateComponentEntry(m.components[i]);
    if (err) errors.push(`components[${i}]: ${err}`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
