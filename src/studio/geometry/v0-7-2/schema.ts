import {
  GEOMETRY_CONTRACT_VERSION_V072,
  NAIL_SURFACE_COORDINATE_CONTRACT_V1,
  type CanonicalGeometrySnapshotV1,
  type GeometryEvaluationRecordV1,
  type GeometryIssueV1,
  type GeometryOperationGraphV1,
  type GeometryRepresentationSetV1,
  type GeometryRepresentationV1,
  type NailSurfaceDefinitionV1,
  type NailSurfaceGeometryBundleV1,
} from './model';

export type GeometryParseResultV1<T> = { ok: true; value: T } | { ok: false; issues: GeometryIssueV1[] };

type JsonObject = Record<string, unknown>;
type Collector = { issues: GeometryIssueV1[] };
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/;

function issue(c: Collector, path: string, message: string): void {
  if (c.issues.length < 200) c.issues.push({ path, code: 'invalid_contract', message });
}

function objectAt(value: unknown, path: string, c: Collector): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issue(c, path, 'must be an object');
    return null;
  }
  return value as JsonObject;
}

function exactKeys(value: JsonObject, allowed: readonly string[], required: readonly string[], path: string, c: Collector): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) issue(c, `${path}.${key}`, 'unknown key');
  for (const key of required) if (!(key in value)) issue(c, `${path}.${key}`, 'required');
}

function stringAt(value: unknown, path: string, c: Collector, pattern?: RegExp): value is string {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    issue(c, path, 'must be a valid non-empty string');
    return false;
  }
  return true;
}

function finiteAt(value: unknown, path: string, c: Collector, min?: number, max?: number): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (min !== undefined && value < min) || (max !== undefined && value > max)) {
    issue(c, path, 'must be a finite number in range');
    return false;
  }
  return true;
}

function intAt(value: unknown, path: string, c: Collector, min = 0): value is number {
  if (!finiteAt(value, path, c, min) || !Number.isInteger(value)) {
    if (typeof value === 'number' && Number.isFinite(value)) issue(c, path, 'must be an integer');
    return false;
  }
  return true;
}

function enumAt<T extends string>(value: unknown, values: readonly T[], path: string, c: Collector): value is T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    issue(c, path, `must be one of ${values.join(', ')}`);
    return false;
  }
  return true;
}

function arrayAt(value: unknown, path: string, c: Collector, min = 0): unknown[] | null {
  if (!Array.isArray(value) || value.length < min) {
    issue(c, path, `must be an array with at least ${min} item(s)`);
    return null;
  }
  return value;
}

function tuple3(value: unknown, path: string, c: Collector, positive = false): void {
  const arr = arrayAt(value, path, c, 3);
  if (!arr || arr.length !== 3) return issue(c, path, 'must contain exactly 3 values');
  arr.forEach((entry, index) => finiteAt(entry, `${path}[${index}]`, c, positive ? Number.EPSILON : undefined));
}

function version(value: JsonObject, path: string, c: Collector): void {
  if (value.schemaVersion !== GEOMETRY_CONTRACT_VERSION_V072) issue(c, `${path}.schemaVersion`, `must equal ${GEOMETRY_CONTRACT_VERSION_V072}`);
}

function versionedRef(value: unknown, path: string, c: Collector): void {
  const obj = objectAt(value, path, c);
  if (!obj) return;
  exactKeys(obj, ['id', 'revision', 'sha256'], ['id', 'revision', 'sha256'], path, c);
  stringAt(obj.id, `${path}.id`, c, ID);
  stringAt(obj.revision, `${path}.revision`, c, ID);
  stringAt(obj.sha256, `${path}.sha256`, c, SHA256);
}

function coordinate(value: unknown, path: string, c: Collector): void {
  const obj = objectAt(value, path, c);
  if (!obj) return;
  const keys = ['contract', 'unit', 'handedness', 'origin', 'xAxis', 'yAxis', 'zAxis'];
  exactKeys(obj, keys, keys, path, c);
  if (obj.contract !== NAIL_SURFACE_COORDINATE_CONTRACT_V1) issue(c, `${path}.contract`, 'coordinate contract mismatch');
  if (obj.unit !== 'mm' || obj.handedness !== 'right' || obj.origin !== 'nail_root_center' || obj.xAxis !== 'right' || obj.yAxis !== 'root_to_tip_negative' || obj.zAxis !== 'outward') {
    issue(c, path, 'coordinate axes must match the canonical contract');
  }
}

function increasingStations(value: unknown, path: string, c: Collector, kind: 'c' | 'longitudinal' | 'thickness'): void {
  const rows = arrayAt(value, path, c, kind === 'c' ? 3 : 2);
  if (!rows) return;
  let previous = -1;
  rows.forEach((entry, index) => {
    const rowPath = `${path}[${index}]`;
    const row = objectAt(entry, rowPath, c);
    if (!row) return;
    const keys = kind === 'c' ? ['v', 'widthMm', 'crownRiseMm', 'radiusMm'] : kind === 'longitudinal' ? ['v', 'outerZMm', 'innerZMm'] : ['v', 'thicknessMm'];
    exactKeys(row, keys, keys, rowPath, c);
    if (finiteAt(row.v, `${rowPath}.v`, c, 0, 1)) {
      if ((row.v as number) <= previous) issue(c, `${rowPath}.v`, 'stations must be strictly increasing');
      previous = row.v as number;
    }
    if (kind === 'c') {
      finiteAt(row.widthMm, `${rowPath}.widthMm`, c, Number.EPSILON);
      finiteAt(row.crownRiseMm, `${rowPath}.crownRiseMm`, c, 0);
      finiteAt(row.radiusMm, `${rowPath}.radiusMm`, c, Number.EPSILON);
    } else if (kind === 'longitudinal') {
      finiteAt(row.outerZMm, `${rowPath}.outerZMm`, c);
      finiteAt(row.innerZMm, `${rowPath}.innerZMm`, c);
      if (typeof row.outerZMm === 'number' && typeof row.innerZMm === 'number' && row.outerZMm <= row.innerZMm) issue(c, rowPath, 'outer surface must remain above inner surface');
    } else finiteAt(row.thicknessMm, `${rowPath}.thicknessMm`, c, Number.EPSILON);
  });
}

function parse<T>(input: unknown, validate: (obj: JsonObject, c: Collector) => void): GeometryParseResultV1<T> {
  const c: Collector = { issues: [] };
  const obj = objectAt(input, '$', c);
  if (obj) validate(obj, c);
  return c.issues.length ? { ok: false, issues: c.issues } : { ok: true, value: structuredClone(input) as T };
}

export function parseNailSurfaceDefinitionV1(input: unknown): GeometryParseResultV1<NailSurfaceDefinitionV1> {
  return parse(input, (obj, c) => {
    const keys = ['schemaVersion', 'surfaceDefinitionId', 'revision', 'sha256', 'sourceType', 'sourceRefs', 'coordinateFrame', 'planform', 'surfaceFrames', 'shapeDefinition', 'evidence'];
    exactKeys(obj, keys, keys, '$', c); version(obj, '$', c);
    stringAt(obj.surfaceDefinitionId, '$.surfaceDefinitionId', c, ID); stringAt(obj.revision, '$.revision', c, ID); stringAt(obj.sha256, '$.sha256', c, SHA256);
    enumAt(obj.sourceType, ['designed', 'generated', 'scanned', 'fitted'], '$.sourceType', c);
    arrayAt(obj.sourceRefs, '$.sourceRefs', c, 1)?.forEach((entry, i) => versionedRef(entry, `$.sourceRefs[${i}]`, c));
    coordinate(obj.coordinateFrame, '$.coordinateFrame', c);
    const planform = objectAt(obj.planform, '$.planform', c);
    if (planform) {
      exactKeys(planform, ['silhouetteRef', 'widthMm', 'lengthMm', 'landmarks'], ['silhouetteRef', 'widthMm', 'lengthMm', 'landmarks'], '$.planform', c);
      versionedRef(planform.silhouetteRef, '$.planform.silhouetteRef', c); finiteAt(planform.widthMm, '$.planform.widthMm', c, Number.EPSILON); finiteAt(planform.lengthMm, '$.planform.lengthMm', c, Number.EPSILON);
      const landmarks = arrayAt(planform.landmarks, '$.planform.landmarks', c, 5);
      const ids = new Set<string>();
      landmarks?.forEach((entry, i) => { const p = `$.planform.landmarks[${i}]`; const row = objectAt(entry, p, c); if (!row) return; exactKeys(row, ['id', 'xMm', 'yMm', 'zMm'], ['id', 'xMm', 'yMm', 'zMm'], p, c); enumAt(row.id, ['tip', 'root_center', 'left_side', 'right_side', 'apex'], `${p}.id`, c); if (typeof row.id === 'string') ids.add(row.id); finiteAt(row.xMm, `${p}.xMm`, c); finiteAt(row.yMm, `${p}.yMm`, c); finiteAt(row.zMm, `${p}.zMm`, c); });
      if (ids.size !== 5) issue(c, '$.planform.landmarks', 'all five unique canonical landmarks are required');
    }
    const frames = objectAt(obj.surfaceFrames, '$.surfaceFrames', c);
    if (frames) { const keys2 = ['classes', 'uvContract', 'seam', 'tangentPolicy']; exactKeys(frames, keys2, keys2, '$.surfaceFrames', c); if (JSON.stringify(frames.classes) !== JSON.stringify(['outer', 'inner', 'rim'])) issue(c, '$.surfaceFrames.classes', 'must be outer, inner, rim'); if (frames.uvContract !== 'nail-local-u-left-right-v-tip-root-v1' || frames.seam !== 'root_center' || frames.tangentPolicy !== 'right_handed_tangent_frame') issue(c, '$.surfaceFrames', 'surface frame contract mismatch'); }
    const shape = objectAt(obj.shapeDefinition, '$.shapeDefinition', c);
    if (shape) { const keys2 = ['cCurveStations', 'longitudinalStations', 'cavityDepthMm', 'thickness']; exactKeys(shape, keys2, keys2, '$.shapeDefinition', c); increasingStations(shape.cCurveStations, '$.shapeDefinition.cCurveStations', c, 'c'); increasingStations(shape.longitudinalStations, '$.shapeDefinition.longitudinalStations', c, 'longitudinal'); finiteAt(shape.cavityDepthMm, '$.shapeDefinition.cavityDepthMm', c, Number.EPSILON); const thickness = objectAt(shape.thickness, '$.shapeDefinition.thickness', c); if (thickness) { exactKeys(thickness, ['mode', 'stations'], ['mode', 'stations'], '$.shapeDefinition.thickness', c); enumAt(thickness.mode, ['normal', 'vertical_preview_thickness'], '$.shapeDefinition.thickness.mode', c); increasingStations(thickness.stations, '$.shapeDefinition.thickness.stations', c, 'thickness'); } }
    const evidence = objectAt(obj.evidence, '$.evidence', c);
    if (evidence) { const keys2 = ['fidelity', 'manufacturingValidated', 'limitations', 'validationRefs']; exactKeys(evidence, keys2, keys2, '$.evidence', c); enumAt(evidence.fidelity, ['exact', 'approximate', 'unavailable'], '$.evidence.fidelity', c); if (evidence.manufacturingValidated !== false) issue(c, '$.evidence.manufacturingValidated', 'architecture fixture cannot claim manufacturing validation'); arrayAt(evidence.limitations, '$.evidence.limitations', c, 1)?.forEach((v, i) => stringAt(v, `$.evidence.limitations[${i}]`, c)); arrayAt(evidence.validationRefs, '$.evidence.validationRefs', c)?.forEach((v, i) => versionedRef(v, `$.evidence.validationRefs[${i}]`, c)); }
  });
}

function topology(value: unknown, path: string, c: Collector): void {
  const obj = objectAt(value, path, c); if (!obj) return;
  const keys = ['vertexCount', 'triangleCount', 'componentCount', 'boundaryEdgeCount', 'nonManifoldEdgeCount', 'degenerateTriangleCount', 'windingErrorCount', 'watertight'];
  exactKeys(obj, keys, keys, path, c); keys.slice(0, -1).forEach((key) => intAt(obj[key], `${path}.${key}`, c)); if (typeof obj.watertight !== 'boolean') issue(c, `${path}.watertight`, 'must be boolean');
  if (obj.watertight === true && (obj.boundaryEdgeCount !== 0 || obj.nonManifoldEdgeCount !== 0 || obj.windingErrorCount !== 0)) issue(c, path, 'watertight metrics are inconsistent');
}

function attributes(value: unknown, path: string, c: Collector): void {
  const obj = objectAt(value, path, c); if (!obj) return; const keys = ['normal', 'uv', 'tangent', 'materialGroup', 'faceProvenance']; exactKeys(obj, keys, keys, path, c); keys.forEach((key) => enumAt(obj[key], ['preserved', 'degraded', 'unavailable'], `${path}.${key}`, c));
}

export function parseCanonicalGeometrySnapshotV1(input: unknown): GeometryParseResultV1<CanonicalGeometrySnapshotV1> {
  return parse(input, (obj, c) => {
    const keys = ['schemaVersion', 'geometrySnapshotId', 'revision', 'geometryHash', 'sourceDefinitions', 'coordinateFrame', 'topology', 'boundsMm', 'volumeMm3', 'surfaceAreaMm2', 'regions', 'attributes', 'toolchain', 'evidence']; exactKeys(obj, keys, keys, '$', c); version(obj, '$', c);
    stringAt(obj.geometrySnapshotId, '$.geometrySnapshotId', c, ID); stringAt(obj.revision, '$.revision', c, ID); stringAt(obj.geometryHash, '$.geometryHash', c, SHA256); arrayAt(obj.sourceDefinitions, '$.sourceDefinitions', c, 1)?.forEach((v, i) => versionedRef(v, `$.sourceDefinitions[${i}]`, c)); coordinate(obj.coordinateFrame, '$.coordinateFrame', c); topology(obj.topology, '$.topology', c);
    const bounds = objectAt(obj.boundsMm, '$.boundsMm', c); if (bounds) { exactKeys(bounds, ['min', 'max'], ['min', 'max'], '$.boundsMm', c); tuple3(bounds.min, '$.boundsMm.min', c); tuple3(bounds.max, '$.boundsMm.max', c); }
    finiteAt(obj.volumeMm3, '$.volumeMm3', c, Number.EPSILON); finiteAt(obj.surfaceAreaMm2, '$.surfaceAreaMm2', c, Number.EPSILON);
    arrayAt(obj.regions, '$.regions', c, 3)?.forEach((v, i) => { const p = `$.regions[${i}]`; const row = objectAt(v, p, c); if (!row) return; exactKeys(row, ['regionId', 'faceCount'], ['regionId', 'faceCount'], p, c); stringAt(row.regionId, `${p}.regionId`, c, ID); intAt(row.faceCount, `${p}.faceCount`, c, 1); });
    attributes(obj.attributes, '$.attributes', c);
    const toolchain = objectAt(obj.toolchain, '$.toolchain', c); if (toolchain) { exactKeys(toolchain, ['evaluatorId', 'evaluatorRevision', 'buildSha256'], ['evaluatorId', 'evaluatorRevision', 'buildSha256'], '$.toolchain', c); stringAt(toolchain.evaluatorId, '$.toolchain.evaluatorId', c, ID); stringAt(toolchain.evaluatorRevision, '$.toolchain.evaluatorRevision', c, ID); stringAt(toolchain.buildSha256, '$.toolchain.buildSha256', c, SHA256); }
    const evidence = objectAt(obj.evidence, '$.evidence', c); if (evidence) { exactKeys(evidence, ['fidelity', 'manufacturingValidated', 'limitations'], ['fidelity', 'manufacturingValidated', 'limitations'], '$.evidence', c); enumAt(evidence.fidelity, ['exact', 'approximate', 'unavailable'], '$.evidence.fidelity', c); if (evidence.manufacturingValidated !== false) issue(c, '$.evidence.manufacturingValidated', 'must remain false'); arrayAt(evidence.limitations, '$.evidence.limitations', c, 1)?.forEach((v, i) => stringAt(v, `$.evidence.limitations[${i}]`, c)); }
  });
}

function representation(value: unknown, path: string, c: Collector): void {
  const obj = objectAt(value, path, c);
  if (!obj) return;
  const keys = ['schemaVersion', 'representationId', 'revision', 'format', 'role', 'geometrySnapshotRef', 'coordinateFrame', 'canonicalTriangleSha256', 'artifact', 'attributes', 'evidence'];
  exactKeys(obj, keys, keys, path, c);
  version(obj, path, c);
  stringAt(obj.representationId, `${path}.representationId`, c, ID);
  stringAt(obj.revision, `${path}.revision`, c, ID);
  const formatOk = enumAt(obj.format, ['glb', 'stl'], `${path}.format`, c);
  const roleOk = enumAt(obj.role, ['browser_preview', 'internal_geometry_interchange'], `${path}.role`, c);
  versionedRef(obj.geometrySnapshotRef, `${path}.geometrySnapshotRef`, c);
  coordinate(obj.coordinateFrame, `${path}.coordinateFrame`, c);
  stringAt(obj.canonicalTriangleSha256, `${path}.canonicalTriangleSha256`, c, SHA256);
  if (objectAt(obj.geometrySnapshotRef, `${path}.geometrySnapshotRef`, c)?.sha256 !== obj.canonicalTriangleSha256) {
    issue(c, `${path}.canonicalTriangleSha256`, 'must equal geometrySnapshotRef.sha256');
  }
  const artifact = objectAt(obj.artifact, `${path}.artifact`, c);
  if (artifact) {
    exactKeys(artifact, ['path', 'runtimeUrl', 'mimeType', 'sha256', 'byteLength', 'visibility'], ['path', 'mimeType', 'sha256', 'byteLength', 'visibility'], `${path}.artifact`, c);
    stringAt(artifact.path, `${path}.artifact.path`, c);
    if (artifact.runtimeUrl !== undefined) stringAt(artifact.runtimeUrl, `${path}.artifact.runtimeUrl`, c);
    enumAt(artifact.mimeType, ['model/gltf-binary', 'model/stl'], `${path}.artifact.mimeType`, c);
    stringAt(artifact.sha256, `${path}.artifact.sha256`, c, SHA256);
    intAt(artifact.byteLength, `${path}.artifact.byteLength`, c, 1);
    enumAt(artifact.visibility, ['DEV_REVIEW_ONLY', 'BROWSER_PREVIEW', 'INTERNAL_ONLY_NOT_SERVED_NOT_EXPORTED'], `${path}.artifact.visibility`, c);
    if (formatOk && obj.format === 'glb' && (obj.role !== 'browser_preview' || artifact.mimeType !== 'model/gltf-binary' || !['DEV_REVIEW_ONLY', 'BROWSER_PREVIEW'].includes(String(artifact.visibility)) || typeof artifact.runtimeUrl !== 'string')) issue(c, `${path}.artifact`, 'GLB preview representation contract mismatch');
    if (formatOk && obj.format === 'stl' && (obj.role !== 'internal_geometry_interchange' || artifact.mimeType !== 'model/stl' || artifact.visibility !== 'INTERNAL_ONLY_NOT_SERVED_NOT_EXPORTED' || artifact.runtimeUrl !== undefined)) issue(c, `${path}.artifact`, 'STL internal representation contract mismatch');
    if (roleOk && obj.role === 'browser_preview' && obj.format !== 'glb') issue(c, `${path}.role`, 'browser preview must use GLB');
  }
  const attrs = objectAt(obj.attributes, `${path}.attributes`, c);
  if (attrs) {
    const attrKeys = ['normal', 'uv', 'materialGroup'];
    exactKeys(attrs, attrKeys, attrKeys, `${path}.attributes`, c);
    attrKeys.forEach((key) => enumAt(attrs[key], ['preserved', 'degraded', 'unavailable'], `${path}.attributes.${key}`, c));
  }
  const evidence = objectAt(obj.evidence, `${path}.evidence`, c);
  if (evidence) {
    const evidenceKeys = ['fidelity', 'productVisualSignoff', 'manufacturingValidated', 'limitations'];
    exactKeys(evidence, evidenceKeys, evidenceKeys, `${path}.evidence`, c);
    enumAt(evidence.fidelity, ['exact', 'approximate', 'unavailable'], `${path}.evidence.fidelity`, c);
    if (typeof evidence.productVisualSignoff !== 'boolean') issue(c, `${path}.evidence.productVisualSignoff`, 'must be boolean');
    if (evidence.manufacturingValidated !== false) issue(c, `${path}.evidence.manufacturingValidated`, 'must remain false');
    arrayAt(evidence.limitations, `${path}.evidence.limitations`, c, 1)?.forEach((entry, index) => stringAt(entry, `${path}.evidence.limitations[${index}]`, c));
  }
}

export function parseGeometryRepresentationV1(input: unknown): GeometryParseResultV1<GeometryRepresentationV1> {
  return parse(input, (obj, c) => representation(obj, '$', c));
}

export function parseGeometryRepresentationSetV1(input: unknown): GeometryParseResultV1<GeometryRepresentationSetV1> {
  return parse(input, (obj, c) => {
    const keys = ['schemaVersion', 'representationSetId', 'revision', 'geometrySnapshotRef', 'representations', 'parity'];
    exactKeys(obj, keys, keys, '$', c);
    version(obj, '$', c);
    stringAt(obj.representationSetId, '$.representationSetId', c, ID);
    stringAt(obj.revision, '$.revision', c, ID);
    versionedRef(obj.geometrySnapshotRef, '$.geometrySnapshotRef', c);
    const rootRef = objectAt(obj.geometrySnapshotRef, '$.geometrySnapshotRef', c);
    const formats = new Set<string>();
    arrayAt(obj.representations, '$.representations', c, 2)?.forEach((entry, index) => {
      representation(entry, `$.representations[${index}]`, c);
      const item = objectAt(entry, `$.representations[${index}]`, c);
      if (!item) return;
      if (typeof item.format === 'string') {
        if (formats.has(item.format)) issue(c, `$.representations[${index}].format`, 'duplicate representation format');
        formats.add(item.format);
      }
      const ref = objectAt(item.geometrySnapshotRef, `$.representations[${index}].geometrySnapshotRef`, c);
      if (rootRef && ref && (ref.id !== rootRef.id || ref.revision !== rootRef.revision || ref.sha256 !== rootRef.sha256)) issue(c, `$.representations[${index}].geometrySnapshotRef`, 'must equal set geometrySnapshotRef');
    });
    if (!formats.has('glb') || !formats.has('stl')) issue(c, '$.representations', 'GLB and STL representations are both required');
    const parity = objectAt(obj.parity, '$.parity', c);
    if (parity) {
      const parityKeys = ['canonicalTriangleSha256', 'sameCanonicalTriangles', 'boundsToleranceMm'];
      exactKeys(parity, parityKeys, parityKeys, '$.parity', c);
      stringAt(parity.canonicalTriangleSha256, '$.parity.canonicalTriangleSha256', c, SHA256);
      if (parity.sameCanonicalTriangles !== true) issue(c, '$.parity.sameCanonicalTriangles', 'must be true');
      finiteAt(parity.boundsToleranceMm, '$.parity.boundsToleranceMm', c, 0, 0.1);
      if (rootRef && parity.canonicalTriangleSha256 !== rootRef.sha256) issue(c, '$.parity.canonicalTriangleSha256', 'must equal geometrySnapshotRef.sha256');
    }
  });
}

export function parseNailSurfaceGeometryBundleV1(input: unknown): GeometryParseResultV1<NailSurfaceGeometryBundleV1> {
  return parse(input, (obj, c) => {
    const keys = ['schemaVersion', 'bundleId', 'revision', 'surfaceDefinition', 'canonicalGeometry', 'representationSet'];
    exactKeys(obj, keys, keys, '$', c);
    version(obj, '$', c);
    stringAt(obj.bundleId, '$.bundleId', c, ID);
    stringAt(obj.revision, '$.revision', c, ID);
    const surfaceResult = parseNailSurfaceDefinitionV1(obj.surfaceDefinition);
    if (!surfaceResult.ok) surfaceResult.issues.forEach((entry) => issue(c, `$.surfaceDefinition${entry.path.slice(1)}`, entry.message));
    const snapshotResult = parseCanonicalGeometrySnapshotV1(obj.canonicalGeometry);
    if (!snapshotResult.ok) snapshotResult.issues.forEach((entry) => issue(c, `$.canonicalGeometry${entry.path.slice(1)}`, entry.message));
    const representationResult = parseGeometryRepresentationSetV1(obj.representationSet);
    if (!representationResult.ok) representationResult.issues.forEach((entry) => issue(c, `$.representationSet${entry.path.slice(1)}`, entry.message));
    if (surfaceResult.ok && snapshotResult.ok) {
      const expected = snapshotResult.value.sourceDefinitions[0];
      const surface = surfaceResult.value;
      if (!expected || expected.id !== surface.surfaceDefinitionId || expected.revision !== surface.revision || expected.sha256 !== surface.sha256) issue(c, '$.canonicalGeometry.sourceDefinitions[0]', 'must reference the bundled surface definition');
    }
    if (snapshotResult.ok && representationResult.ok) {
      const expected = representationResult.value.geometrySnapshotRef;
      const snapshot = snapshotResult.value;
      if (expected.id !== snapshot.geometrySnapshotId || expected.revision !== snapshot.revision || expected.sha256 !== snapshot.geometryHash) issue(c, '$.representationSet.geometrySnapshotRef', 'must reference the bundled canonical geometry');
    }
  });
}

export function parseGeometryOperationGraphV1(input: unknown): GeometryParseResultV1<GeometryOperationGraphV1> {
  return parse(input, (obj, c) => {
    const keys = ['schemaVersion', 'graphId', 'revision', 'sha256', 'nodes', 'outputRef']; exactKeys(obj, keys, keys, '$', c); version(obj, '$', c); stringAt(obj.graphId, '$.graphId', c, ID); stringAt(obj.revision, '$.revision', c, ID); stringAt(obj.sha256, '$.sha256', c, SHA256); stringAt(obj.outputRef, '$.outputRef', c, ID);
    const nodes = arrayAt(obj.nodes, '$.nodes', c, 1); const nodeIds = new Set<string>(); const outputs = new Set<string>();
    nodes?.forEach((v, i) => { const p = `$.nodes[${i}]`; const row = objectAt(v, p, c); if (!row) return; const k = ['nodeId', 'operation', 'inputRefs', 'outputRef', 'transform', 'toleranceMm', 'componentPolicy', 'attributePolicy', 'evidenceExpectation']; exactKeys(row, k, k, p, c); if (stringAt(row.nodeId, `${p}.nodeId`, c, ID)) { if (nodeIds.has(row.nodeId)) issue(c, `${p}.nodeId`, 'duplicate node id'); nodeIds.add(row.nodeId); } enumAt(row.operation, ['shell_from_surface', 'project_or_conform', 'relief_from_outline', 'place_attachment', 'union', 'subtract', 'intersect', 'validate'], `${p}.operation`, c); const inputs = arrayAt(row.inputRefs, `${p}.inputRefs`, c, 1); inputs?.forEach((x, j) => stringAt(x, `${p}.inputRefs[${j}]`, c, ID)); if (stringAt(row.outputRef, `${p}.outputRef`, c, ID)) { if (outputs.has(row.outputRef)) issue(c, `${p}.outputRef`, 'duplicate output ref'); outputs.add(row.outputRef); } const t = objectAt(row.transform, `${p}.transform`, c); if (t) { exactKeys(t, ['translationMm', 'rotationDeg', 'scale'], ['translationMm', 'rotationDeg', 'scale'], `${p}.transform`, c); tuple3(t.translationMm, `${p}.transform.translationMm`, c); tuple3(t.rotationDeg, `${p}.transform.rotationDeg`, c); tuple3(t.scale, `${p}.transform.scale`, c, true); } finiteAt(row.toleranceMm, `${p}.toleranceMm`, c, 0.000001, 0.5); const cp = objectAt(row.componentPolicy, `${p}.componentPolicy`, c); if (cp) { const ck = ['empty', 'minComponents', 'maxComponents', 'primaryComponentRequired']; exactKeys(cp, ck, ck, `${p}.componentPolicy`, c); enumAt(cp.empty, ['allow', 'reject'], `${p}.componentPolicy.empty`, c); intAt(cp.minComponents, `${p}.componentPolicy.minComponents`, c); intAt(cp.maxComponents, `${p}.componentPolicy.maxComponents`, c); if (typeof cp.minComponents === 'number' && typeof cp.maxComponents === 'number' && cp.minComponents > cp.maxComponents) issue(c, `${p}.componentPolicy`, 'minComponents cannot exceed maxComponents'); if (typeof cp.primaryComponentRequired !== 'boolean') issue(c, `${p}.componentPolicy.primaryComponentRequired`, 'must be boolean'); } const ap = objectAt(row.attributePolicy, `${p}.attributePolicy`, c); if (ap) { const ak = ['uv', 'materialGroup', 'faceProvenance']; exactKeys(ap, ak, ak, `${p}.attributePolicy`, c); ak.forEach((key) => enumAt(ap[key], ['preserve', 'allow_degraded', 'ignore'], `${p}.attributePolicy.${key}`, c)); } enumAt(row.evidenceExpectation, ['exact', 'approximate', 'unavailable'], `${p}.evidenceExpectation`, c); });
    if (typeof obj.outputRef === 'string' && !outputs.has(obj.outputRef)) issue(c, '$.outputRef', 'must reference a node output');
  });
}

export function parseGeometryEvaluationRecordV1(input: unknown): GeometryParseResultV1<GeometryEvaluationRecordV1> {
  return parse(input, (obj, c) => {
    const allowed = ['schemaVersion', 'evaluationId', 'graphRef', 'inputGeometryHashes', 'kernel', 'toleranceMm', 'status', 'outputGeometryHash', 'outputMetrics', 'attributes', 'warnings', 'error', 'performance', 'evidence'];
    const required = ['schemaVersion', 'evaluationId', 'graphRef', 'inputGeometryHashes', 'kernel', 'toleranceMm', 'status', 'attributes', 'warnings', 'performance', 'evidence'];
    exactKeys(obj, allowed, required, '$', c);
    version(obj, '$', c);
    stringAt(obj.evaluationId, '$.evaluationId', c, ID);
    versionedRef(obj.graphRef, '$.graphRef', c);
    arrayAt(obj.inputGeometryHashes, '$.inputGeometryHashes', c, 1)?.forEach((v, i) => stringAt(v, `$.inputGeometryHashes[${i}]`, c, SHA256));
    const kernel = objectAt(obj.kernel, '$.kernel', c);
    if (kernel) {
      exactKeys(kernel, ['adapterId', 'adapterRevision', 'buildSha256'], ['adapterId', 'adapterRevision', 'buildSha256'], '$.kernel', c);
      stringAt(kernel.adapterId, '$.kernel.adapterId', c, ID);
      stringAt(kernel.adapterRevision, '$.kernel.adapterRevision', c, ID);
      stringAt(kernel.buildSha256, '$.kernel.buildSha256', c, SHA256);
    }
    finiteAt(obj.toleranceMm, '$.toleranceMm', c, 0.000001, 0.5);
    enumAt(obj.status, ['succeeded', 'degraded', 'failed', 'cancelled'], '$.status', c);
    if ((obj.status === 'succeeded' || obj.status === 'degraded') && (!stringAt(obj.outputGeometryHash, '$.outputGeometryHash', c, SHA256) || !obj.outputMetrics)) issue(c, '$', 'successful evaluation requires output hash and metrics');
    if ((obj.status === 'failed' || obj.status === 'cancelled') && !obj.error) issue(c, '$.error', 'failed/cancelled evaluation requires error');
    if (obj.outputMetrics) {
      const metrics = objectAt(obj.outputMetrics, '$.outputMetrics', c);
      if (metrics) {
        const metricKeys = ['vertexCount', 'triangleCount', 'componentCount', 'boundaryEdgeCount', 'nonManifoldEdgeCount', 'degenerateTriangleCount', 'windingErrorCount', 'watertight', 'volumeMm3', 'surfaceAreaMm2'];
        exactKeys(metrics, metricKeys, metricKeys, '$.outputMetrics', c);
        metricKeys.slice(0, 7).forEach((key) => intAt(metrics[key], `$.outputMetrics.${key}`, c));
        if (typeof metrics.watertight !== 'boolean') issue(c, '$.outputMetrics.watertight', 'must be boolean');
        if (metrics.watertight === true && (metrics.boundaryEdgeCount !== 0 || metrics.nonManifoldEdgeCount !== 0 || metrics.windingErrorCount !== 0)) issue(c, '$.outputMetrics', 'watertight metrics are inconsistent');
        finiteAt(metrics.volumeMm3, '$.outputMetrics.volumeMm3', c, 0);
        finiteAt(metrics.surfaceAreaMm2, '$.outputMetrics.surfaceAreaMm2', c, 0);
      }
    }
    attributes(obj.attributes, '$.attributes', c);
    if (!Array.isArray(obj.warnings)) issue(c, '$.warnings', 'must be array');
    const performance = objectAt(obj.performance, '$.performance', c);
    if (performance) {
      exactKeys(performance, ['elapsedMs', 'peakMemoryBytes'], ['elapsedMs', 'peakMemoryBytes'], '$.performance', c);
      finiteAt(performance.elapsedMs, '$.performance.elapsedMs', c, 0);
      intAt(performance.peakMemoryBytes, '$.performance.peakMemoryBytes', c);
    }
    const evidence = objectAt(obj.evidence, '$.evidence', c);
    if (evidence) {
      exactKeys(evidence, ['fidelity', 'manufacturingValidated'], ['fidelity', 'manufacturingValidated'], '$.evidence', c);
      enumAt(evidence.fidelity, ['exact', 'approximate', 'unavailable'], '$.evidence.fidelity', c);
      if (evidence.manufacturingValidated !== false) issue(c, '$.evidence.manufacturingValidated', 'must remain false');
    }
  });
}
