import { useEffect, useState } from 'react';
import type { AssetRefV7, FlatDesignElementV7, RgbaColorV7 } from '../v7/model';
import {
  FLAT_ASSET_MIME_PNG_V7,
  FLAT_SYSTEM_SANS_FALLBACK_CSS_V7,
  flatContentAssetStatusV7,
  isRegisteredFontV7,
  resolveBundledFlatAssetV7,
  resolveFontCssFamilyV7,
  shortAssetIdV7,
} from '../v7/flat-content-assets';
import {
  createFlatAssetRepositoryV7,
  createLocalFlatAssetStorageV7,
  type FlatAssetGetResultV7,
  type FlatAssetRepositoryV7,
} from '../v7/flat-content-repository';
import { OfficialTemplatePatternV7 } from './OfficialTemplatePatternV7';

/**
 * V7-10 shared flat content artwork renderer (designer canvas AND customer
 * preview). Resolution order is deterministic:
 *
 *   1. official template pattern — exact checksum rendering (unchanged);
 *   2. bundled sticker/stamp — synchronous versioned public source URL;
 *   3. imported asset — async resolution through the injected repository
 *      (the designer injects the store's read-only resolver; the customer
 *      preview falls back to the local read-only envelope);
 *   4. missing/corrupt/unresolvable — visible clipped recovery placeholder
 *      with status and shortened asset id. Never returns null and never
 *      mutates or deletes the canonical element.
 *
 * Imported SVG source may be encoded into an image data URL in this derived
 * DOM only; EditorDocV7 keeps only the AssetRefV7 metadata.
 */

const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 160;
const MM_TO_CANVAS_UNITS = 8;

export type FlatContentImportResolverV7 = (ref: AssetRefV7) => Promise<FlatAssetGetResultV7>;

let defaultFlatAssetRepositoryV7: FlatAssetRepositoryV7 | null = null;

/** Read-only localStorage-backed resolver used when no repository is injected. */
function defaultResolveImportedV7(ref: AssetRefV7): Promise<FlatAssetGetResultV7> {
  if (!defaultFlatAssetRepositoryV7) {
    defaultFlatAssetRepositoryV7 = createFlatAssetRepositoryV7(createLocalFlatAssetStorageV7());
  }
  return defaultFlatAssetRepositoryV7.get(ref);
}

function rgba(color: RgbaColorV7, opacity = 1): string {
  return `rgb(${color.r} ${color.g} ${color.b} / ${Math.min(1, Math.max(0, color.a * opacity))})`;
}

function bytesToBase64V7(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

/** Derived-DOM-only encoding: imported validated SVG text becomes a data URL. */
function svgSourceToImageDataUrlV7(source: string): string {
  return `data:image/svg+xml;base64,${bytesToBase64V7(new TextEncoder().encode(source))}`;
}

function FlatContentTextV7({ element }: { element: Extract<FlatDesignElementV7, { kind: 'text' }> }) {
  const cssFamily = resolveFontCssFamilyV7(element.fontRef);
  const registered = isRegisteredFontV7(element.fontRef);
  return (
    <text
      x={CANVAS_WIDTH / 2}
      y={CANVAS_HEIGHT / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={element.fontSizeMm * MM_TO_CANVAS_UNITS}
      fontFamily={cssFamily ?? FLAT_SYSTEM_SANS_FALLBACK_CSS_V7}
      fill={rgba(element.color, element.opacity)}
      data-flat-content-kind="text"
      data-font-status={registered ? 'registered' : 'fallback'}
    >
      {element.text}
    </text>
  );
}

type ImportResolveStateV7 =
  | { status: 'pending' }
  | { status: 'ready'; source: string; mimeType: string }
  | { status: 'missing' }
  | { status: 'corrupt'; message: string };

function FlatContentImportV7({
  element,
  resolveImported,
}: {
  element: Extract<FlatDesignElementV7, { kind: 'image_2d' }>;
  resolveImported: FlatContentImportResolverV7;
}) {
  const [state, setState] = useState<ImportResolveStateV7>({ status: 'pending' });
  const { asset } = element;
  const refKey = `${asset.assetId}@${asset.revision}#${asset.sha256}`;

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'pending' });
    resolveImported(asset)
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'valid') setState({ status: 'ready', source: result.source, mimeType: result.asset.mimeType });
        else if (result.status === 'missing') setState({ status: 'missing' });
        else if (result.status === 'corrupt') setState({ status: 'corrupt', message: result.message });
        else setState({ status: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'corrupt', message: '素材解析失败' });
      });
    return () => {
      cancelled = true;
    };
    // Resolve only when the canonical ref changes; the resolver is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey, asset.assetId, asset.revision, asset.sha256, resolveImported]);

  if (state.status === 'ready') {
    const href = state.mimeType === FLAT_ASSET_MIME_PNG_V7 ? state.source : svgSourceToImageDataUrlV7(state.source);
    return (
      <image
        href={href}
        x="0"
        y="0"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
        opacity={element.opacity}
        data-flat-content-kind="image"
        data-flat-content-status="import"
        data-resolver-status="valid"
      />
    );
  }
  return (
    <g data-flat-content-kind="image" data-flat-content-status="import" data-resolver-status={state.status}>
      <rect x="8" y="8" width="84" height="144" rx="6" fill="#f7f4f2" stroke="#d8cfca" strokeWidth="1" strokeDasharray="4 3" />
      <text x="50" y="72" textAnchor="middle" fontSize="8" fill="#8a7f7a">
        {state.status === 'pending' ? '素材解析中…' : state.status === 'missing' ? '素材缺失' : '素材损坏'}
      </text>
      <text x="50" y="86" textAnchor="middle" fontSize="6" fill="#a89d97" data-testid="flat-asset-short-id">
        {shortAssetIdV7(asset.assetId)}
      </text>
      {state.status === 'corrupt' && <text x="50" y="98" textAnchor="middle" fontSize="5" fill="#b3a8a2">{state.message}</text>}
    </g>
  );
}

function FlatContentImageV7({
  element,
  instanceId,
  resolveImported,
}: {
  element: Extract<FlatDesignElementV7, { kind: 'image_2d' }>;
  instanceId: string;
  resolveImported: FlatContentImportResolverV7;
}) {
  // Official template patterns keep their exact checksum rendering.
  const official = (
    <OfficialTemplatePatternV7 element={element} instanceId={instanceId} />
  );
  const bundled = resolveBundledFlatAssetV7(element.asset);
  if (bundled) {
    return (
      <image
        href={bundled.sourceUrl}
        x="0"
        y="0"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
        opacity={element.opacity}
        data-flat-content-kind="image"
        data-flat-content-status="bundled"
        data-bundle-id={bundled.id}
        data-resolver-status="bundled"
      />
    );
  }
  // Async import resolution; `official` is only reachable when the element is
  // a registered official template (checked above via the same classifier).
  if (flatContentAssetStatusV7(element.asset) === 'official') return official;
  return <FlatContentImportV7 element={element} resolveImported={resolveImported} />;
}

export function FlatContentArtworkV7({
  element,
  instanceId,
  resolveImported,
}: {
  element: FlatDesignElementV7;
  instanceId: string;
  resolveImported?: FlatContentImportResolverV7;
}) {
  if (element.kind === 'text') return <FlatContentTextV7 element={element} />;
  if (element.kind === 'image_2d') {
    return (
      <FlatContentImageV7
        element={element}
        instanceId={instanceId}
        resolveImported={resolveImported ?? defaultResolveImportedV7}
      />
    );
  }
  return null;
}
