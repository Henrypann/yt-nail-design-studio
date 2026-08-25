/**
 * LayerPanelV6 — V6-native layer management (PR-07).
 * Displays and manages per-finger layer stack from EditorDocV6.
 */

import { useEditorV6Store, selectCurrentNail } from '../store-v6';
import type { EditorLayerV6 } from '../v6/model';
import { useLocale, type Locale } from '@/lib/i18n';
import { resolveTaxonomyEntry, taxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';

const LEGACY_DEFAULT_LAYER_NAMES = new Set([
  'Base surface', 'Base Surface', 'Draw', '2D Art', 'Attachment',
  'Base surface', 'Draw', '2D Art', 'Attachment', 'Gem', 'Relief', 'Recipe',
]);

function layerLabel(layer: EditorLayerV6, locale: Locale): string {
  const entry = resolveTaxonomyEntry('layer', layer.typeId);
  const isDefaultName = !layer.name ||
    layer.name === entry?.en ||
    layer.name === entry?.zh ||
    LEGACY_DEFAULT_LAYER_NAMES.has(layer.name);
  return isDefaultName ? taxonomyLabel('layer', layer.typeId, locale) : layer.name;
}

export function LayerPanelV6() {
  const { locale, t } = useLocale();
  // Subscribe through the selector so changing currentFinger rerenders the
  // panel even when the document object itself has not changed.
  const nail = useEditorV6Store(selectCurrentNail);
  const activeLayerId = useEditorV6Store((s) => s.activeLayerId);
  const setActiveLayerId = useEditorV6Store((s) => s.setActiveLayerId);
  const toggleLayerVisibleOnCurrent = useEditorV6Store((s) => s.toggleLayerVisibleOnCurrent);
  const toggleLayerLockedOnCurrent = useEditorV6Store((s) => s.toggleLayerLockedOnCurrent);
  const createLayerOnCurrent = useEditorV6Store((s) => s.createLayerOnCurrent);
  const deleteLayerOnCurrent = useEditorV6Store((s) => s.deleteLayerOnCurrent);
  const reorderLayerOnCurrent = useEditorV6Store((s) => s.reorderLayerOnCurrent);
  const readOnly = useEditorV6Store((s) => s.readOnly);

  if (!nail) return null;

  const layers = nail.layers;

  return (
    <div className="flex flex-col gap-1 p-2" data-debug-id="studio.editor.layer-panel-v6">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-medium text-gray-500">{t('app.layers2')}</h3>
        {!readOnly && (
          <button
            className="rounded px-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={() => createLayerOnCurrent('builtin.draw', taxonomyLabel('layer', 'builtin.draw', locale))}
            title={t('app.addHandPaintLayer')}
          >
            +
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {[...layers].reverse().map((layer) => (
          <button
            key={layer.id}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors ${
              layer.id === activeLayerId
                ? 'bg-plum-50 text-plum-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setActiveLayerId(layer.id)}
          >
            {/* Visibility toggle */}
            <span
              className={`cursor-pointer text-nano ${layer.visible ? 'text-gray-400' : 'text-gray-300'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) toggleLayerVisibleOnCurrent(layer.id);
              }}
              title={layer.visible ? t('editor.extra.hide') : t('editor.extra.show')}
            >
              {layer.visible ? '👁' : '—'}
            </span>

            {/* Lock toggle */}
            <span
              className={`cursor-pointer text-nano ${layer.locked ? 'text-amber-500' : 'text-gray-300'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) toggleLayerLockedOnCurrent(layer.id);
              }}
              title={layer.locked ? t('editor.extra.unlock') : t('editor.extra.lock')}
            >
              {layer.locked ? '🔒' : '—'}
            </span>

            {/* Layer name */}
            <span className="flex-1 truncate">{layerLabel(layer, locale)}</span>

            {/* Element count */}
            <span className="text-nano text-gray-400">
              {layer.elements.length > 0 ? layer.elements.length : ''}
            </span>

            {/* Actions */}
            {!readOnly && layer.typeId !== 'builtin.base_surface' && (
              <span className="flex gap-0.5">
                <span
                  className="cursor-pointer text-nano text-gray-300 hover:text-gray-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderLayerOnCurrent(layer.id, 'up');
                  }}
                  title={t('editor.extra.moveUp')}
                >
                  ↑
                </span>
                <span
                  className="cursor-pointer text-nano text-gray-300 hover:text-gray-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderLayerOnCurrent(layer.id, 'down');
                  }}
                  title={t('editor.extra.moveDown')}
                >
                  ↓
                </span>
                <span
                  className="cursor-pointer text-nano text-red-300 hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayerOnCurrent(layer.id);
                  }}
                  title={t('editor.extra.delete')}
                >
                  ×
                </span>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
