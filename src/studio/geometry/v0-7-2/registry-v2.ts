import registryInput from '../../../../assets/geometry/registry-v2.json' with { type: 'json' };
import type { GeometryFidelityV1, GeometryVersionedRefV1 } from './model';

export const GEOMETRY_REGISTRY_V2_SCHEMA_VERSION = '2.0.0' as const;

export type GeometryRegistryConsumerV2 =
  | 'single_nail_pbr'
  | 'geometry_kernel_preview'
  | 'manufacturing_compiler'
  | 'device_job'
  | 'production_export';

export interface GeometryRegistryBundleRefV2 extends GeometryVersionedRefV1 {
  path: string;
}

export interface GeometryBrowserDeliveryV2 {
  representationId: string;
  revision: string;
  runtimeUrl: string;
  mimeType: 'model/gltf-binary';
  sha256: string;
  byteLength: number;
  triangleCount: number;
}

export interface GeometryRegistryEntryV2 {
  registryEntryId: string;
  revision: string;
  shape: 'almond';
  length: 'medium';
  promotionState: 'promoted_simulated_preview';
  promotionClass: 'simulated_preview_geometry_kernel';
  bundleRef: GeometryRegistryBundleRefV2;
  surfaceDefinitionRef: GeometryVersionedRefV1;
  geometrySnapshotRef: GeometryVersionedRefV1;
  representationSetRef: GeometryVersionedRefV1;
  browserDelivery: GeometryBrowserDeliveryV2;
  policy: {
    fidelity: Extract<GeometryFidelityV1, 'approximate'>;
    allowedConsumers: Array<Extract<GeometryRegistryConsumerV2, 'single_nail_pbr' | 'geometry_kernel_preview'>>;
    forbiddenConsumers: Array<Extract<GeometryRegistryConsumerV2, 'manufacturing_compiler' | 'device_job' | 'production_export'>>;
    writerEffect: 'none';
  };
  evidence: {
    productVisualSignoff: 'PRODUCT_VISUAL_SIGNED_OFF';
    representationParityVerified: true;
    bundleIntegrityVerified: true;
    manufacturingValidated: false;
    promotedAt: string;
    validationRefs: string[];
    limitations: string[];
  };
}

export interface GeometryRegistryV2 {
  schemaVersion: typeof GEOMETRY_REGISTRY_V2_SCHEMA_VERSION;
  registryId: 'nextgen-beauty.geometry-registry-v2';
  revision: string;
  geometryContractVersion: '1.0.0';
  entries: GeometryRegistryEntryV2[];
}

export type GeometryRegistryParseResultV2 =
  | { ok: true; value: GeometryRegistryV2 }
  | { ok: false; issues: Array<{ path: string; message: string }> };

const SHA = /^[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: Array<{ path: string; message: string }>,
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push({ path: `${path}.${key}`, message: 'unknown key' });
  }
  for (const key of keys) {
    if (!(key in value)) issues.push({ path: `${path}.${key}`, message: 'required' });
  }
}

function string(
  value: unknown,
  pattern: RegExp,
  path: string,
  issues: Array<{ path: string; message: string }>,
): value is string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    issues.push({ path, message: 'invalid string' });
    return false;
  }
  return true;
}

function ref(
  value: unknown,
  path: string,
  issues: Array<{ path: string; message: string }>,
  withPath = false,
): void {
  const row = object(value);
  if (!row) {
    issues.push({ path, message: 'must be object' });
    return;
  }
  const keys = withPath ? ['id', 'revision', 'sha256', 'path'] : ['id', 'revision', 'sha256'];
  hasExactKeys(row, keys, path, issues);
  string(row.id, ID, `${path}.id`, issues);
  string(row.revision, ID, `${path}.revision`, issues);
  string(row.sha256, SHA, `${path}.sha256`, issues);
  if (withPath) string(row.path, /^assets\/[a-zA-Z0-9._/-]+\.json$/, `${path}.path`, issues);
}

function stringArray(
  value: unknown,
  allowed: readonly string[] | null,
  path: string,
  issues: Array<{ path: string; message: string }>,
): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    issues.push({ path, message: 'must be a non-empty string array' });
    return [];
  }
  const rows = value as string[];
  if (new Set(rows).size !== rows.length) issues.push({ path, message: 'duplicates are forbidden' });
  if (allowed && rows.some((entry) => !allowed.includes(entry))) issues.push({ path, message: 'contains unsupported value' });
  return rows;
}

export function parseGeometryRegistryV2(input: unknown): GeometryRegistryParseResultV2 {
  const issues: Array<{ path: string; message: string }> = [];
  const root = object(input);
  if (!root) return { ok: false, issues: [{ path: '$', message: 'must be object' }] };
  hasExactKeys(root, ['schemaVersion', 'registryId', 'revision', 'geometryContractVersion', 'entries'], '$', issues);
  if (root.schemaVersion !== GEOMETRY_REGISTRY_V2_SCHEMA_VERSION) issues.push({ path: '$.schemaVersion', message: 'unsupported registry schema' });
  if (root.registryId !== 'nextgen-beauty.geometry-registry-v2') issues.push({ path: '$.registryId', message: 'registry id mismatch' });
  string(root.revision, ID, '$.revision', issues);
  if (root.geometryContractVersion !== '1.0.0') issues.push({ path: '$.geometryContractVersion', message: 'geometry contract mismatch' });
  if (!Array.isArray(root.entries) || root.entries.length === 0) {
    issues.push({ path: '$.entries', message: 'at least one entry is required' });
  } else {
    const ids = new Set<string>();
    root.entries.forEach((entry, index) => {
      const path = `$.entries[${index}]`;
      const row = object(entry);
      if (!row) {
        issues.push({ path, message: 'must be object' });
        return;
      }
      const keys = ['registryEntryId', 'revision', 'shape', 'length', 'promotionState', 'promotionClass', 'bundleRef', 'surfaceDefinitionRef', 'geometrySnapshotRef', 'representationSetRef', 'browserDelivery', 'policy', 'evidence'];
      hasExactKeys(row, keys, path, issues);
      if (string(row.registryEntryId, ID, `${path}.registryEntryId`, issues)) {
        if (ids.has(row.registryEntryId)) issues.push({ path: `${path}.registryEntryId`, message: 'duplicate registry entry' });
        ids.add(row.registryEntryId);
      }
      string(row.revision, ID, `${path}.revision`, issues);
      if (row.shape !== 'almond' || row.length !== 'medium') issues.push({ path, message: 'only signed-off almond medium v3 is promotable' });
      if (row.promotionState !== 'promoted_simulated_preview' || row.promotionClass !== 'simulated_preview_geometry_kernel') issues.push({ path, message: 'promotion class mismatch' });
      ref(row.bundleRef, `${path}.bundleRef`, issues, true);
      ref(row.surfaceDefinitionRef, `${path}.surfaceDefinitionRef`, issues);
      ref(row.geometrySnapshotRef, `${path}.geometrySnapshotRef`, issues);
      ref(row.representationSetRef, `${path}.representationSetRef`, issues);
      const delivery = object(row.browserDelivery);
      if (!delivery) issues.push({ path: `${path}.browserDelivery`, message: 'must be object' });
      else {
        const deliveryKeys = ['representationId', 'revision', 'runtimeUrl', 'mimeType', 'sha256', 'byteLength', 'triangleCount'];
        hasExactKeys(delivery, deliveryKeys, `${path}.browserDelivery`, issues);
        string(delivery.representationId, ID, `${path}.browserDelivery.representationId`, issues);
        string(delivery.revision, ID, `${path}.browserDelivery.revision`, issues);
        string(delivery.runtimeUrl, /^\/geometry-v0-7-2\/[a-zA-Z0-9._/-]+\.glb$/, `${path}.browserDelivery.runtimeUrl`, issues);
        if (delivery.mimeType !== 'model/gltf-binary') issues.push({ path: `${path}.browserDelivery.mimeType`, message: 'must be GLB' });
        string(delivery.sha256, SHA, `${path}.browserDelivery.sha256`, issues);
        for (const field of ['byteLength', 'triangleCount'] as const) {
          if (!Number.isSafeInteger(delivery[field]) || Number(delivery[field]) <= 0) issues.push({ path: `${path}.browserDelivery.${field}`, message: 'must be positive integer' });
        }
      }
      const policy = object(row.policy);
      if (!policy) issues.push({ path: `${path}.policy`, message: 'must be object' });
      else {
        hasExactKeys(policy, ['fidelity', 'allowedConsumers', 'forbiddenConsumers', 'writerEffect'], `${path}.policy`, issues);
        if (policy.fidelity !== 'approximate' || policy.writerEffect !== 'none') issues.push({ path: `${path}.policy`, message: 'promotion must remain approximate and writer-zero' });
        const allowed = stringArray(policy.allowedConsumers, ['single_nail_pbr', 'geometry_kernel_preview'], `${path}.policy.allowedConsumers`, issues);
        const forbidden = stringArray(policy.forbiddenConsumers, ['manufacturing_compiler', 'device_job', 'production_export'], `${path}.policy.forbiddenConsumers`, issues);
        if (allowed.length !== 2 || forbidden.length !== 3) issues.push({ path: `${path}.policy`, message: 'consumer allow/deny policy must be exhaustive' });
      }
      const evidence = object(row.evidence);
      if (!evidence) issues.push({ path: `${path}.evidence`, message: 'must be object' });
      else {
        const evidenceKeys = ['productVisualSignoff', 'representationParityVerified', 'bundleIntegrityVerified', 'manufacturingValidated', 'promotedAt', 'validationRefs', 'limitations'];
        hasExactKeys(evidence, evidenceKeys, `${path}.evidence`, issues);
        if (evidence.productVisualSignoff !== 'PRODUCT_VISUAL_SIGNED_OFF' || evidence.representationParityVerified !== true || evidence.bundleIntegrityVerified !== true || evidence.manufacturingValidated !== false) issues.push({ path: `${path}.evidence`, message: 'promotion evidence mismatch' });
        if (string(evidence.promotedAt, ISO, `${path}.evidence.promotedAt`, issues)) {
          const timestamp = Date.parse(evidence.promotedAt);
          if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== evidence.promotedAt) {
            issues.push({ path: `${path}.evidence.promotedAt`, message: 'invalid timestamp' });
          }
        }
        stringArray(evidence.validationRefs, null, `${path}.evidence.validationRefs`, issues);
        stringArray(evidence.limitations, null, `${path}.evidence.limitations`, issues);
      }
    });
  }
  return issues.length > 0
    ? { ok: false, issues: issues.slice(0, 200) }
    : { ok: true, value: structuredClone(input) as GeometryRegistryV2 };
}

const parsedRegistry = parseGeometryRegistryV2(registryInput);
if (!parsedRegistry.ok) throw new Error(`invalid_geometry_registry_v2:${parsedRegistry.issues[0]?.path ?? '$'}`);
export const GEOMETRY_REGISTRY_V2: GeometryRegistryV2 = parsedRegistry.value;

export type GeometryPromotionResolutionV2 =
  | { status: 'promoted'; entry: GeometryRegistryEntryV2; delivery: GeometryBrowserDeliveryV2; fidelity: 'approximate'; manufacturingValidated: false }
  | { status: 'unavailable'; reason: 'not_registered' | 'consumer_forbidden'; manufacturingValidated: false };

export function resolvePromotedGeometryV2(input: {
  shape: string;
  length: string;
  consumer: GeometryRegistryConsumerV2;
}): GeometryPromotionResolutionV2 {
  const entry = GEOMETRY_REGISTRY_V2.entries.find((candidate) => candidate.shape === input.shape && candidate.length === input.length);
  if (!entry) return { status: 'unavailable', reason: 'not_registered', manufacturingValidated: false };
  if (!(entry.policy.allowedConsumers as GeometryRegistryConsumerV2[]).includes(input.consumer)) {
    return { status: 'unavailable', reason: 'consumer_forbidden', manufacturingValidated: false };
  }
  return {
    status: 'promoted',
    entry: structuredClone(entry),
    delivery: structuredClone(entry.browserDelivery),
    fidelity: 'approximate',
    manufacturingValidated: false,
  };
}
