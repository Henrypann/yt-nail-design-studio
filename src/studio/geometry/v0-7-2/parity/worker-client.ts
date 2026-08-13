import type { GeometryParityCaseV1, GeometryParityComparisonV1, GeometryParityWorkerResponseV1 } from './model';

export interface GeometryParityWorkerOptionsV1 { timeoutMs: number; signal?: AbortSignal }

export interface GeometryParityWorkerLikeV1 {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<GeometryParityWorkerResponseV1>) => void): void;
  addEventListener(type: 'error', listener: () => void): void;
}

export type GeometryParityWorkerFactoryV1 = () => GeometryParityWorkerLikeV1;

export function evaluateGeometryParityInWorkerV1(
  testCase: GeometryParityCaseV1,
  options: GeometryParityWorkerOptionsV1,
  createWorker: GeometryParityWorkerFactoryV1 = () => new Worker(
    new URL('./parity-worker.ts', import.meta.url),
    { type: 'module' },
  ),
): Promise<GeometryParityComparisonV1> {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    return Promise.reject(new TypeError('timeoutMs must be a positive finite number'));
  }
  const worker = createWorker();
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
      callback();
    };
    const abort = () => {
      worker.postMessage({ type: 'cancel', requestId });
      finish(() => reject(new DOMException('Geometry parity evaluation cancelled.', 'AbortError')));
    };
    const timer = setTimeout(() => {
      finish(() => reject(new DOMException('Geometry parity evaluation timed out.', 'TimeoutError')));
    }, options.timeoutMs);
    worker.addEventListener('message', (event: MessageEvent<GeometryParityWorkerResponseV1>) => {
      const response = event.data;
      if (response.requestId !== requestId) return;
      if (response.type === 'result') {
        const result = response.result;
        finish(() => resolve(result));
      } else {
        const message = `${response.code}: ${response.message}`;
        finish(() => reject(new Error(message)));
      }
    });
    worker.addEventListener('error', () => {
      finish(() => reject(new Error('kernel_unavailable: Geometry parity worker failed.')));
    });
    if (options.signal?.aborted) abort();
    else {
      options.signal?.addEventListener('abort', abort, { once: true });
      worker.postMessage({ type: 'evaluate', requestId, testCase });
    }
  });
}
