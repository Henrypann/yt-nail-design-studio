/**
 * Lazy 3D renderer adapter (PR-06).
 * Provides a version-neutral interface for loading Three.js renderers.
 * Actual renderer modules are lazy-loaded to avoid bloating the main bundle.
 */

export type RendererStatus = 'idle' | 'loading' | 'ready' | 'error' | 'fallback_2d';

export interface RendererAdapter {
  /** Current renderer status. */
  readonly status: RendererStatus;
  /** Renderer version identifier (e.g., 'three-pbr/mercury-1'). */
  readonly version: string;
  /** Whether the renderer can handle this recipe. */
  canRender(recipeId: string): boolean;
  /** Initialize the renderer (lazy). Returns true if ready. */
  init(): Promise<boolean>;
  /** Dispose renderer resources. */
  dispose(): void;
}

export interface RendererRegistry {
  /** Find the best renderer for a given recipe. */
  findRenderer(recipeId: string): RendererAdapter | null;
  /** Get all registered renderers. */
  listRenderers(): RendererAdapter[];
}

const renderers: RendererAdapter[] = [];

/** Register a renderer adapter. */
export function registerRenderer(adapter: RendererAdapter): void {
  renderers.push(adapter);
}

/** Create a renderer registry from registered adapters. */
export function createRendererRegistry(): RendererRegistry {
  return {
    findRenderer(recipeId: string): RendererAdapter | null {
      return renderers.find((r) => r.canRender(recipeId)) ?? null;
    },
    listRenderers(): RendererAdapter[] {
      return [...renderers];
    },
  };
}

/**
 * Truthful renderer status check.
 * Returns the status label for display, never overpromises.
 */
export function describeRendererStatus(status: RendererStatus): string {
  switch (status) {
    case 'idle':
      return '未初始化';
    case 'loading':
      return '加载中…';
    case 'ready':
      return '就绪';
    case 'error':
      return '加载失败';
    case 'fallback_2d':
      return '2D 预览';
  }
}
