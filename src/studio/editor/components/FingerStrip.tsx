import { FlipHorizontal2, Heart, LockOpen, RotateCcw } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { FINGER_CODES } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { isFingerUnlocked } from '../lib/model';
import { useEditorStore } from '../store';

export function FingerStrip() {
  const { text } = useLocale();
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
    >
      <div className="w-[218px] shrink-0">
        <p className="mb-1 text-[10px] font-semibold text-gray-700">
          {text('编辑范围', 'EDIT SCOPE')}
        </p>
        <div className="grid grid-cols-2 rounded-button border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            aria-pressed={editScope === 'single'}
            onClick={() => setEditScope('single')}
            className={cx(
              'rounded-button px-2 py-1 text-[11px]',
              editScope === 'single' ? 'bg-white font-medium text-primary shadow-sm' : 'text-gray-500',
            )}
          >
            {text(`仅当前指 ${current}`, `CURRENT ${current}`)}
          </button>
          <button
            type="button"
            aria-pressed={editScope === 'all'}
            onClick={() => setEditScope('all')}
            className={cx(
              'rounded-button px-2 py-1 text-[11px]',
              editScope === 'all' ? 'bg-white font-medium text-primary shadow-sm' : 'text-gray-500',
            )}
          >
            {text('十指同步', 'ALL 10')}
          </button>
        </div>
        <p className="mt-1 truncate text-[9px] text-gray-400">
          {editScope === 'single'
            ? text('绘制、款式和图层只修改当前指', 'Draw, recipes and layers affect this nail only')
            : text('修改共享设计；已有单指例外不覆盖', 'Edits the shared design; overrides stay independent')}
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
                'relative flex h-11 min-w-0 items-center justify-center gap-0.5 rounded-button border text-[10px]',
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
          {text('设为重音指', 'Set accent')}
        </Button>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => mirrorToOpposite('pattern-only')} title={text('复制并镜像到对侧指，可撤销', 'Mirror to opposite nail; undo is available')}>
            <FlipHorizontal2 size={12} />
            {text('镜像', 'Mirror')}
          </Button>
          <Button size="sm" variant="ghost" disabled={readOnly || !currentUnlocked} onClick={() => lockFinger(current)} title={text('清除当前指例外，恢复共享设计', 'Clear this nail override')}>
            <RotateCcw size={12} />
            {text('重置', 'Reset')}
          </Button>
        </div>
      </div>
    </footer>
  );
}
