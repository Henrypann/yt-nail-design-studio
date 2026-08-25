/**
 * 十指编排（模块 4 · PRD §16.2）
 * 十指同步（默认，改一指 = 十指同步）+ 逐指解锁（解锁后独立编辑）+ 主视觉指标记 + 全部重置。
 */

import { useState } from 'react';
import { FlipHorizontal2, Heart, Lock, LockOpen, RotateCcw } from 'lucide-react';
import { Button, Modal, cx, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { FingerCode } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';
import { isFingerUnlocked } from '../lib/model';
import type { MirrorMode } from '../lib/mirror';
import { oppositeFinger } from '../lib/mirror';
import { useEditorStore } from '../store';

const FINGER_LABEL: Record<FingerCode, string> = { L1: 'L1', L2: 'L2', L3: 'L3', L4: 'L4', L5: 'L5', R1: 'R1', R2: 'R2', R3: 'R3', R4: 'R4', R5: 'R5' };

export function FingerPanel() {
  const { t } = useLocale();
  const doc = useEditorStore((s) => s.doc);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const readOnly = useEditorStore((s) => s.readOnly);
  const setCurrentFinger = useEditorStore((s) => s.setCurrentFinger);
  const unlockFinger = useEditorStore((s) => s.unlockFinger);
  const lockFinger = useEditorStore((s) => s.lockFinger);
  const resetAllLocks = useEditorStore((s) => s.resetAllLocks);
  const setMasterFinger = useEditorStore((s) => s.setMasterFinger);
  const mirrorToOpposite = useEditorStore((s) => s.mirrorToOpposite);
  const mirrorLeftHandToRight = useEditorStore((s) => s.mirrorLeftHandToRight);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLock, setConfirmLock] = useState<FingerCode | null>(null);
  const [mirrorConfirm, setMirrorConfirm] = useState<'opposite' | 'leftToRight' | null>(null);
  const [mirrorMode, setMirrorMode] = useState<MirrorMode>('pattern-only');
  const toast = useToast();

  if (!doc) return null;
  const unlocked = FINGER_CODES.filter((f) => isFingerUnlocked(doc, f));
  const syncMode = unlocked.length === 0;

  return (
    <section className="rounded-panel border border-gray-200 bg-white p-3">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-800">{t('editorV7.finger.title')}</h3>
        <span className="text-nano text-gray-400">
          {syncMode ? t('editorV7.finger.sync') : t('editorV7.finger.unlocked', { count: unlocked.length })}
        </span>
      </header>

      <div className="grid grid-cols-5 gap-1">
        {FINGER_CODES.map((f) => {
          const isCurrent = currentFinger === f;
          const isUnlocked = isFingerUnlocked(doc, f);
          const isMaster = doc.masterFinger === f;
          return (
            <button
              key={f}
              title={`${FINGER_LABEL[f]}${isMaster ? ` · ${t('editorV7.finger.master')}` : ''}${isUnlocked ? ` · ${t('editorV7.finger.unlockedLabel')}` : ''}`}
              onClick={() => setCurrentFinger(f)}
              onDoubleClick={() => !readOnly && setMasterFinger(f)}
              className={cx(
                'relative flex flex-col items-center rounded-button border px-1 py-1.5 text-nano transition-colors duration-fast',
                isCurrent
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              <span className="font-medium tnum">{f}</span>
              <span className="flex h-3 items-center gap-0.5">
                {isMaster && <Heart size={9} className="fill-primary text-primary" />}
                {isUnlocked && <LockOpen size={9} className="text-warning" />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-nano leading-4 text-gray-400">
        {t('editorV7.finger.currentSummary', { finger: currentFinger, label: FINGER_LABEL[currentFinger], state: isFingerUnlocked(doc, currentFinger) ? t('editorV7.finger.independent') : t('editorV7.finger.synced'), hint: t('editorV7.finger.masterHint') })}
      </p>

      {!readOnly && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            title={t('editorV7.finger.mirrorTitle', { from: currentFinger, to: oppositeFinger(currentFinger) })}
            onClick={() => setMirrorConfirm('opposite')}
          >
            <FlipHorizontal2 size={12} />
            {t('editorV7.finger.mirrorOpposite')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={t('editorV7.finger.leftMirrorTitle')}
            onClick={() => setMirrorConfirm('leftToRight')}
          >
            <FlipHorizontal2 size={12} />
            {t('editorV7.finger.mirrorLeftRight')}
          </Button>
          {isFingerUnlocked(doc, currentFinger) ? (
            <Button size="sm" variant="secondary" onClick={() => setConfirmLock(currentFinger)}>
              <Lock size={12} />
              {t('editorV7.finger.lockAgain', { finger: currentFinger })}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => unlockFinger(currentFinger)}>
              <LockOpen size={12} />
              {t('editorV7.finger.unlock', { finger: currentFinger })}
            </Button>
          )}
          {unlocked.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={12} />
              {t('editorV7.finger.reset')}
            </Button>
          )}
        </div>
      )}

      {/* 重新锁定：丢弃独立数据，回到同步 */}
      <Modal
        open={confirmLock !== null}
        onClose={() => setConfirmLock(null)}
        title={t('editorV7.finger.lockTitle', { finger: confirmLock ?? '' })}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmLock(null)}>
              {t('editorV7.finger.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirmLock) lockFinger(confirmLock);
                setConfirmLock(null);
              }}
            >
              {t('editorV7.finger.discardLock')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('editorV7.finger.lockDescription', { finger: confirmLock ?? '' })}
        </p>
      </Modal>

      {/* 全部重置 */}
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('editorV7.finger.resetTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              {t('editorV7.finger.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                resetAllLocks();
                setConfirmReset(false);
              }}
            >
              {t('editorV7.finger.clearUnlock')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('editorV7.finger.resetDescription', { count: unlocked.length })}
        </p>
      </Modal>

      {/* 对称映射确认 */}
      <Modal
        open={mirrorConfirm !== null}
        onClose={() => setMirrorConfirm(null)}
        title={
          mirrorConfirm === 'leftToRight'
            ? t('editorV7.finger.mirrorHandTitle')
            : t('editorV7.finger.mirrorOppositeTitle', { finger: oppositeFinger(currentFinger) })
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setMirrorConfirm(null)}>
              {t('editorV7.finger.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (mirrorConfirm === 'opposite') {
                  mirrorToOpposite(mirrorMode);
                  toast.success(t('editorV7.finger.mirrored', { finger: oppositeFinger(currentFinger) }));
                } else if (mirrorConfirm === 'leftToRight') {
                  mirrorLeftHandToRight(mirrorMode);
                  toast.success(t('editorV7.finger.handMirrored'));
                }
                setMirrorConfirm(null);
              }}
            >
              {t('editorV7.finger.confirmMirror')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-gray-600">
          {t('editorV7.finger.mirrorDescription')}
        </p>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="mirrorMode"
              checked={mirrorMode === 'pattern-only'}
              onChange={() => setMirrorMode('pattern-only')}
            />
            {t('editorV7.finger.patternOnly')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="mirrorMode"
              checked={mirrorMode === 'include-base'}
              onChange={() => setMirrorMode('include-base')}
            />
            {t('editorV7.finger.includeBase')}
          </label>
        </div>
      </Modal>
    </section>
  );
}
