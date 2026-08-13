/// <reference lib="webworker" />
import { evaluateGeometryKernelParityV1 } from './evaluate';
import type { GeometryParityWorkerRequestV1, GeometryParityWorkerResponseV1 } from './model';

const cancelled = new Set<string>();
self.addEventListener('message', async (event: MessageEvent<GeometryParityWorkerRequestV1>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    cancelled.add(request.requestId);
    return;
  }
  const respond = (response: GeometryParityWorkerResponseV1) => self.postMessage(response);
  try {
    if (cancelled.has(request.requestId)) throw new DOMException('cancelled', 'AbortError');
    const result = await evaluateGeometryKernelParityV1(request.testCase);
    if (cancelled.has(request.requestId)) throw new DOMException('cancelled', 'AbortError');
    respond({ type: 'result', requestId: request.requestId, result });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    respond({
      type: 'error', requestId: request.requestId,
      code: aborted ? 'cancelled' : 'invalid_topology',
      message: aborted ? 'Geometry parity evaluation cancelled.' : 'Geometry parity evaluation failed.',
    });
  } finally {
    cancelled.delete(request.requestId);
  }
});

export {};
