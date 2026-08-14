import type { SurfaceBooleanBundleV1, SurfaceBooleanInputsV1 } from './surface-boolean';

type WorkerResponse =
  | { type: 'result'; requestId: string; bundle: SurfaceBooleanBundleV1 }
  | { type: 'error'; requestId: string; code: string; message: string };

export async function evaluateSurfaceBooleanInWorkerV1(
  inputs: SurfaceBooleanInputsV1,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<SurfaceBooleanBundleV1> {
  const worker = new Worker(new URL('./surface-boolean-worker.ts', import.meta.url), { type: 'module' });
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException('Aborted', 'AbortError')));
    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error('surface_boolean_worker_timeout')));
    }, options.timeoutMs ?? 30_000);
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestId) return;
      if (response.type === 'result') {
        const { bundle } = response;
        finish(() => resolve(bundle));
      } else {
        const message = `${response.code}:${response.message}`;
        finish(() => reject(new Error(message)));
      }
    };
    worker.onerror = (event) => finish(() => reject(new Error(event.message || 'surface_boolean_worker_failed')));
    if (options.signal?.aborted) onAbort();
    else {
      options.signal?.addEventListener('abort', onAbort, { once: true });
      worker.postMessage({ type: 'evaluate', requestId, inputs });
    }
  });
}
