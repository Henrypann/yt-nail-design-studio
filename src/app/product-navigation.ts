import { Routes } from './routes';

export type ProductSurface = 'community' | 'studio';

export interface ProductOriginConfig {
  VITE_COMMUNITY_ORIGIN?: string;
  VITE_STUDIO_ORIGIN?: string;
}

export const ProductSurfaces = {
  community: {
    id: 'nail-lover-community',
    label: 'Nail Lover Community',
    localMount: '/',
  },
  studio: {
    id: 'nail-design-studio',
    label: 'Nail Design Studio',
    localMount: Routes.studio,
  },
} as const;

const runtimeProductOrigins: ProductOriginConfig = {
  VITE_COMMUNITY_ORIGIN: import.meta.env?.VITE_COMMUNITY_ORIGIN,
  VITE_STUDIO_ORIGIN: import.meta.env?.VITE_STUDIO_ORIGIN,
};

function configuredOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function studioDedicatedPath(localPath: string): string {
  if (localPath === Routes.studio) return '/';
  if (localPath.startsWith(`${Routes.studio}/`)) return localPath.slice(Routes.studio.length);
  return '/';
}

function absoluteProductHref(origin: string, path: string): string {
  return new URL(path, `${origin}/`).toString();
}

/**
 * Cross-product URLs are resolved here so today's single origin can later split into
 * MakerWorld/Bambu-Studio-style origins without changing feature modules.
 */
export function communityProductHref(
  localPath: string = Routes.community,
  env: ProductOriginConfig = runtimeProductOrigins,
): string {
  const origin = configuredOrigin(env.VITE_COMMUNITY_ORIGIN);
  return origin ? absoluteProductHref(origin, localPath) : localPath;
}

export function studioProductHref(
  localPath: string = Routes.studio,
  env: ProductOriginConfig = runtimeProductOrigins,
): string {
  const origin = configuredOrigin(env.VITE_STUDIO_ORIGIN);
  return origin ? absoluteProductHref(origin, studioDedicatedPath(localPath)) : localPath;
}

/**
 * Browser-only Community -> Studio intents currently use localStorage. They can
 * cross a route mount on the same origin, but must fail closed once the two
 * products are deployed on different origins.
 */
export function canUseLocalStudioHandoff(
  currentOrigin: string,
  env: ProductOriginConfig = runtimeProductOrigins,
): boolean {
  const studioOrigin = configuredOrigin(env.VITE_STUDIO_ORIGIN);
  return studioOrigin === null || studioOrigin === currentOrigin;
}
