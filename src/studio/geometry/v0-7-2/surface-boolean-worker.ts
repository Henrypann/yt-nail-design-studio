import { evaluateSurfaceBooleanV1, type SurfaceBooleanInputsV1 } from './surface-boolean';

type Request = { type: 'evaluate'; requestId: string; inputs: SurfaceBooleanInputsV1 };
type Response =
  | { type: 'result'; requestId: string; bundle: Awaited<ReturnType<typeof evaluateSurfaceBooleanV1>> }
  | { type: 'error'; requestId: string; code: 'invalid_topology' | 'kernel_unavailable'; message: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: Response): void;
};

workerScope.onmessage = (event) => {
  if (event.data.type !== 'evaluate') return;
  const { inputs, requestId } = event.data;
  // This worker is only reachable through the DEV-only internal route. Vite serves
  // package WASM with the correct MIME at this URL; production must contain neither
  // this worker nor the kernel/WASM (enforced by the build-output gate).
  const manifoldWasmUrl = new URL('/node_modules/manifold-3d/manifold.wasm', self.location.origin).toString();
  void evaluateSurfaceBooleanV1(inputs, { wasmUrl: manifoldWasmUrl }).then((bundle) => {
    workerScope.postMessage({ type: 'result', requestId, bundle });
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'surface_boolean_failed';
    const code = /topology|deterministic|volume|did_not_change/.test(message)
      ? 'invalid_topology'
      : 'kernel_unavailable';
    workerScope.postMessage({ type: 'error', requestId, code, message });
  });
};
