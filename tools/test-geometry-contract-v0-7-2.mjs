import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GEOMETRY_FAILURE_MATRIX_V1,
  GOLDEN_ALMOND_SNAPSHOT_V1,
  GOLDEN_ALMOND_SURFACE_V1,
  GOLDEN_ATTACHMENT_SNAPSHOT_V1,
  GOLDEN_EVALUATION_RECORD_V1,
  GOLDEN_OPERATION_GRAPH_V1,
  GOLDEN_RELIEF_SNAPSHOT_V1,
  parseCanonicalGeometrySnapshotV1,
  parseGeometryEvaluationRecordV1,
  parseGeometryOperationGraphV1,
  parseNailSurfaceDefinitionV1,
} from '../src/studio/geometry/v0-7-2/index.ts';

const clone = (value) => structuredClone(value);
const parsers = {
  surface: parseNailSurfaceDefinitionV1,
  snapshot: parseCanonicalGeometrySnapshotV1,
  graph: parseGeometryOperationGraphV1,
  evaluation: parseGeometryEvaluationRecordV1,
};
const fixtures = {
  surface: GOLDEN_ALMOND_SURFACE_V1,
  snapshot: GOLDEN_ALMOND_SNAPSHOT_V1,
  graph: GOLDEN_OPERATION_GRAPH_V1,
  evaluation: GOLDEN_EVALUATION_RECORD_V1,
};

for (const [name, value] of Object.entries(fixtures)) {
  const frozen = JSON.stringify(value);
  const result = parsers[name](value);
  assert.equal(result.ok, true, `${name} fixture must parse: ${JSON.stringify(!result.ok && result.issues)}`);
  assert.deepEqual(result.ok && result.value, value, `${name} parse must be lossless`);
  assert.equal(JSON.stringify(value), frozen, `${name} parser must be pure`);
}
for (const fixture of [GOLDEN_RELIEF_SNAPSHOT_V1, GOLDEN_ATTACHMENT_SNAPSHOT_V1]) {
  assert.equal(parseCanonicalGeometrySnapshotV1(fixture).ok, true, 'operand fixture must parse');
}

assert.equal(GOLDEN_ALMOND_SURFACE_V1.shapeDefinition.thickness.mode, 'normal');
assert.deepEqual(GOLDEN_ALMOND_SURFACE_V1.surfaceFrames.classes, ['outer', 'inner', 'rim']);
assert.ok(GOLDEN_ALMOND_SURFACE_V1.shapeDefinition.cCurveStations.length >= 3);
assert.ok(GOLDEN_OPERATION_GRAPH_V1.nodes.some((node) => node.operation === 'union'));
assert.ok(GOLDEN_OPERATION_GRAPH_V1.nodes.some((node) => node.operation === 'subtract'));
assert.ok(GOLDEN_OPERATION_GRAPH_V1.nodes.some((node) => node.operation === 'intersect'));
assert.equal(GOLDEN_EVALUATION_RECORD_V1.evidence.manufacturingValidated, false);

for (const row of GEOMETRY_FAILURE_MATRIX_V1) {
  const invalid = clone(fixtures[row.target]);
  row.mutate(invalid);
  const result = parsers[row.target](invalid);
  assert.equal(result.ok, false, `${row.id} must fail closed`);
  assert.ok(!result.ok && result.issues.some((entry) => entry.path === row.expectedPath || entry.path.startsWith(row.expectedPath)), `${row.id} must report ${row.expectedPath}: ${JSON.stringify(!result.ok && result.issues)}`);
}

const schemaPath = path.resolve('src/studio/geometry/v0-7-2/geometry-contract-v1.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
for (const name of ['nailSurfaceDefinition', 'canonicalGeometrySnapshot', 'operationGraph', 'operationNode', 'evaluationRecord', 'outputMetrics', 'error']) {
  assert.equal(schema.$defs[name].additionalProperties, false, `${name} must reject unknown keys`);
}
assert.equal(schema.$defs.nailSurfaceDefinition.properties.evidence.properties.manufacturingValidated.const, false);

const original = clone(GOLDEN_ALMOND_SNAPSHOT_V1);
const derived = clone(GOLDEN_ALMOND_SNAPSHOT_V1);
derived.regions[0].faceCount += 1;
assert.deepEqual(GOLDEN_ALMOND_SNAPSHOT_V1, original, 'fixtures must not share mutable nested references');

console.log('[ARCH-v0.7.2-3D-01] geometry contracts / golden fixtures / failure matrix: PASS');
