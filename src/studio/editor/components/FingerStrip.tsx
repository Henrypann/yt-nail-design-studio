import { FlipHorizontal2, Heart, LockOpen, RotateCcw } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { FINGER_CODES } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { isFingerUnlocked } from '../lib/model';
import { useEditorStore } from '../store';

export function FingerStrip() {
  const { t } = useLocale();
  const doc = useEditorStore((state) => state.doc);
  const readOnly = useEditorStore((state) => state.readOnly);
  const current = useEditorStore((state) => state.currentFinger);
  const editScope = useEditorStore((state) => state.editScope);
  const setCurrent = useEditorStore((state) => state.setCurrentFinger);
  const setEditScope = useEditorStore((state) => state.setEditScope);
  const setMaster = useEditorStore((state) => state.setMasterFinger);
  const lockFinger = useEditorStore((state) => state.lockFinger);
  const mirrorToOpposite = useEditorStore((state) => state.mirrorToOpposite);
  if (!doc) return null;

  const currentUnlocked = isFingerUnlocked(doc, current);
  return (
    <footer
      className="flex h-20 shrink-0 items-center gap-3 border-t border-gray-200 bg-white px-3"
      data-testid="editor-finger-strip"
      data-debug-id="studio.editor.finger-strip"
    >
      <div className="w-[218px] shrink-0">
        <p className="mb-1 text-nano font-semibold text-gray-700">
          {t('app.editScope')}
        </p>
        <div className="grid grid-cols-2 rounded-button border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            aria-pressed={editScope === 'single'}
            onClick={() => setEditScope('single')}
            className={cx(
              'rounded-button px-2 py-1 text-nano',
              editScope === 'single' ? 'bg-white font-medium text-primary shadow-sm' : 'text-gray-500',
            )}
          >
            {t('app.currentCurrent', { current: current })}
          </button>
          <button
            type="button"
            aria-pressed={editScope === 'all'}
            onClick={() => setEditScope('all')}
            className={cx(
              'rounded-button px-2 py-1 text-nano',
              editScope === 'all' ? 'bg-white font-medium text-primary shadow-sm' : 'text-gray-500',
            )}
          >
            {t('app.all10')}
          </button>
        </div>
        <p className="mt-1 truncate text-nano text-gray-400">
          {editScope === 'single'
            ? t('app.drawRecipesLayersAffectNailOnly')
            : t('app.editsSharedDesignOverridesStayIndependent')}
        </p>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-10 gap-1">
        {FINGER_CODES.map((finger) => {
          const selected = current === finger;
          const master = doc.masterFinger === finger;
          const unlocked = isFingerUnlocked(doc, finger);
          return (
            <button
              key={finger}
              onClick={() => setCurrent(finger)}
              className={cx(
                'relative flex h-11 min-w-0 items-center justify-center gap-0.5 rounded-button border text-nano',
                selected ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
              title={`${finger}${master ? ' · Accent nail' : ''}${unlocked ? ' · Individual override' : ''}`}
            >
              {finger}
              {master && <Heart size={9} className="fill-primary text-primary" />}
              {unlocked && <LockOpen size={9} className="text-warning" />}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        <Button size="sm" variant="ghost" disabled={readOnly || doc.masterFinger === current} onClick={() => setMaster(current)}>
          <Heart size={12} />
          {t('app.setAccent')}
        </Button>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => mirrorToOpposite('pattern-only')} title={t('app.mirrorOppositeNailUndoAvailable')}>
            <FlipHorizontal2 size={12} />
            {t('app.mirror')}
          </Button>
          <Button size="sm" variant="ghost" disabled={readOnly || !currentUnlocked} onClick={() => lockFinger(current)} title={t('app.clearNailOverride')}>
            <RotateCcw size={12} />
            {t('app.reset')}
          </Button>
        </div>
      </div>
    </footer>
  );
}
