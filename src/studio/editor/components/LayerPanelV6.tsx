/**
 * LayerPanelV6 — V6-native layer management (PR-07).
 * Displays and manages per-finger layer stack from EditorDocV6.
 */

import { useEditorV6Store, selectCurrentNail } from '../store-v6';
import type { EditorLayerV6 } from '../v6/model';

const LAYER_TYPE_LABELS: Record<string, string> = {
  'builtin.base_surface': '底色/表面',
  'builtin.draw': '手绘',
  'builtin.art_2d': '二维素材',
  'builtin.attachment': '附件',
  'builtin.relief': '立体结构',
  'builtin.recipe': '配方层',
};

function layerLabel(layer: EditorLayerV6): string {
  return layer.name || LAYER_TYPE_LABELS[layer.typeId] || layer.typeId;
}

export function LayerPanelV6() {
  const doc = useEditorV6Store((s) => s.doc);
  const activeLayerId = useEditorV6Store((s) => s.activeLayerId);
  const setActiveLayerId = useEditorV6Store((s) => s.setActiveLayerId);
  const toggleLayerVisibleOnCurrent = useEditorV6Store((s) => s.toggleLayerVisibleOnCurrent);
  const toggleLayerLockedOnCurrent = useEditorV6Store((s) => s.toggleLayerLockedOnCurrent);
  const createLayerOnCurrent = useEditorV6Store((s) => s.createLayerOnCurrent);
  const deleteLayerOnCurrent = useEditorV6Store((s) => s.deleteLayerOnCurrent);
  const reorderLayerOnCurrent = useEditorV6Store((s) => s.reorderLayerOnCurrent);
  const readOnly = useEditorV6Store((s) => s.readOnly);

  const nail = selectCurrentNail(useEditorV6Store.getState());
  if (!doc || !nail) return null;

  const layers = nail.layers;

  return (
    <div className="flex flex-col gap-1 p-2" data-debug-id="studio.editor.layer-panel-v6">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-medium text-gray-500">图层</h3>
        {!readOnly && (
          <button
            className="rounded px-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={() => createLayerOnCurrent('builtin.draw', '手绘')}
            title="添加手绘图层"
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
              className={`cursor-pointer text-[10px] ${layer.visible ? 'text-gray-400' : 'text-gray-300'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) toggleLayerVisibleOnCurrent(layer.id);
              }}
              title={layer.visible ? '隐藏' : '显示'}
            >
              {layer.visible ? '👁' : '—'}
            </span>

            {/* Lock toggle */}
            <span
              className={`cursor-pointer text-[10px] ${layer.locked ? 'text-amber-500' : 'text-gray-300'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) toggleLayerLockedOnCurrent(layer.id);
              }}
              title={layer.locked ? '解锁' : '锁定'}
            >
              {layer.locked ? '🔒' : '—'}
            </span>

            {/* Layer name */}
            <span className="flex-1 truncate">{layerLabel(layer)}</span>

            {/* Element count */}
            <span className="text-[10px] text-gray-400">
              {layer.elements.length > 0 ? layer.elements.length : ''}
            </span>

            {/* Actions */}
            {!readOnly && layer.typeId !== 'builtin.base_surface' && (
              <span className="flex gap-0.5">
                <span
                  className="cursor-pointer text-[10px] text-gray-300 hover:text-gray-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderLayerOnCurrent(layer.id, 'up');
                  }}
                  title="上移"
                >
                  ↑
                </span>
                <span
                  className="cursor-pointer text-[10px] text-gray-300 hover:text-gray-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderLayerOnCurrent(layer.id, 'down');
                  }}
                  title="下移"
                >
                  ↓
                </span>
                <span
                  className="cursor-pointer text-[10px] text-red-300 hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayerOnCurrent(layer.id);
                  }}
                  title="删除"
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
