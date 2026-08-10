import { getPatternArtwork } from '../lib/material';
import type { FlatDesignElementV7 } from '../v7/model';
import { identifyOfficialTemplatePatternV7 } from '../v7/official-template-assets';

type ImageElementV7 = Extract<FlatDesignElementV7, { kind: 'image_2d' }>;

function scopeSvgIds(inner: string, prefix: string): string {
  const ids = [...inner.matchAll(/\bid="([A-Za-z_][\w:.-]*)"/g)].map((match) => match[1]);
  return ids.reduce((scoped, id) => {
    const next = `${prefix}-${id}`;
    return scoped
      .split(`id="${id}"`).join(`id="${next}"`)
      .split(`url(#${id})`).join(`url(#${next})`)
      .split(`href="#${id}"`).join(`href="#${next}"`)
      .split(`xlink:href="#${id}"`).join(`xlink:href="#${next}"`);
  }, inner);
}

/** Read-only adapter for checksum-verified SVGs bundled in material-library. */
export function OfficialTemplatePatternV7({ element, instanceId }: {
  element: ImageElementV7;
  instanceId: string;
}) {
  const identity = identifyOfficialTemplatePatternV7(element.asset);
  if (!identity) return null;
  const artwork = getPatternArtwork(identity.templateId, identity.shape);
  if (!artwork) return null;
  const inner = scopeSvgIds(artwork.inner, instanceId);
  return (
    <svg
      x="0"
      y="0"
      width="100"
      height="160"
      viewBox={artwork.viewBox}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      opacity={element.opacity}
      aria-hidden="true"
      data-v7-official-template={identity.templateId}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
