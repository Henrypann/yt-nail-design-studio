import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import {
  createParityFixture,
  evaluateGeometryKernelParityV1,
  evaluateGeometryParityInWorkerV1,
} from '../src/studio/geometry/v0-7-2/parity/index.ts';

for (const operation of ['union', 'subtract', 'intersect']) {
  const testCase = createParityFixture(operation);
  const first = await evaluateGeometryKernelParityV1(testCase);
  const second = await evaluateGeometryKernelParityV1(testCase);
  if (operation === 'intersect') {
    assert.equal(first.comparison.accepted, false, 'current intersect must not be accepted while it has open edges');
    assert.equal(first.comparison.decision, 'candidate_preferred');
    assert.ok(first.current.topology.boundaryEdgeCount > 0, 'current intersect limitation must remain visible');
    assert.equal(first.candidate.topology.boundaryEdgeCount, 0, 'Manifold intersect must stay closed');
    assert.ok(first.comparison.relativeVolumeDelta > 0.01, 'intersect disagreement must be recorded');
  } else {
    assert.equal(first.comparison.accepted, true, `${operation} must pass parity thresholds`);
    assert.equal(first.comparison.bothClosedSingleComponents, true);
    assert.equal(first.comparison.decision, 'equivalent');
    assert.ok(first.comparison.relativeVolumeDelta <= 0.01);
  }
  assert.ok(first.comparison.maxBoundsDeltaMm <= testCase.toleranceMm);
  assert.equal(first.comparison.attributeConclusion, 'equivalent_degraded');
  assert.equal(first.current.topology.geometryHash, second.current.topology.geometryHash,
    `${operation} current kernel must be deterministic`);
  assert.equal(first.candidate.topology.geometryHash, second.candidate.topology.geometryHash,
    `${operation} Manifold kernel must be deterministic`);
  assert.notEqual(first.current.topology.geometryHash, first.candidate.topology.geometryHash,
    'cross-kernel acceptance must not depend on identical triangulation');
}

const workerClient = await readFile(new URL('../src/studio/geometry/v0-7-2/parity/worker-client.ts', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../src/studio/geometry/v0-7-2/parity/parity-worker.ts', import.meta.url), 'utf8');
assert.match(workerClient, /new Worker\([\s\S]*new URL\('\.\/parity-worker\.ts'/);
assert.match(workerClient, /worker\.terminate\(\)/);
assert.match(workerClient, /TimeoutError/);
assert.match(workerClient, /AbortError/);
assert.match(workerSource, /request\.type === 'cancel'/);

function fakeWorker() {
  const listeners = { message: [], error: [] };
  return {
    posted: [], terminated: false,
    postMessage(message) { this.posted.push(message); },
    terminate() { this.terminated = true; },
    addEventListener(type, listener) { listeners[type].push(listener); },
  };
}

const timeoutWorker = fakeWorker();
await assert.rejects(
  evaluateGeometryParityInWorkerV1(createParityFixture('union'), { timeoutMs: 5 }, () => timeoutWorker),
  (error) => error instanceof DOMException && error.name === 'TimeoutError',
);
assert.equal(timeoutWorker.terminated, true);

const abortWorker = fakeWorker();
const controller = new AbortController();
controller.abort();
await assert.rejects(
  evaluateGeometryParityInWorkerV1(
    createParityFixture('subtract'),
    { timeoutMs: 100, signal: controller.signal },
    () => abortWorker,
  ),
  (error) => error instanceof DOMException && error.name === 'AbortError',
);
assert.equal(abortWorker.posted[0].type, 'cancel');
assert.equal(abortWorker.terminated, true);
await assert.rejects(
  evaluateGeometryParityInWorkerV1(createParityFixture('union'), { timeoutMs: 0 }, () => fakeWorker()),
  /positive finite/,
);

const dist = new URL('../dist/', import.meta.url);
let distFiles = [];
try { distFiles = await readdir(dist, { recursive: true }); } catch {}
const forbidden = distFiles.filter((file) => /manifold|three-bvh-csg|parity-worker/i.test(file));
assert.deepEqual(forbidden, [], `production build must not contain parity kernels: ${forbidden.join(', ')}`);

console.log('test-geometry-kernel-parity-v0-7-2: PASS (three operations, deterministic kernels, Worker boundary, zero production leakage)');
