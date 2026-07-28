/**
 * 十指编排（模块 4 · PRD §16.2）
 * 十指同步（默认，改一指 = 十指同步）+ 逐指解锁（解锁后独立编辑）+ 主视觉指标记 + 全部重置。
 */

import { useState } from 'react';
import { Heart, Lock, LockOpen, RotateCcw } from 'lucide-react';
import { Button, Modal, cx } from '@/design-system';
import type { FingerCode } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';
import { isFingerUnlocked } from '../lib/model';
import { useEditorStore } from '../store';

const FINGER_LABEL: Record<FingerCode, string> = {
  L1: '左拇指', L2: '左食指', L3: '左中指', L4: '左无名指', L5: '左小指',
  R1: '右拇指', R2: '右食指', R3: '右中指', R4: '右无名指', R5: '右小指',
};

export function FingerPanel() {
  const doc = useEditorStore((s) => s.doc);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const readOnly = useEditorStore((s) => s.readOnly);
  const setCurrentFinger = useEditorStore((s) => s.setCurrentFinger);
  const unlockFinger = useEditorStore((s) => s.unlockFinger);
  const lockFinger = useEditorStore((s) => s.lockFinger);
  const resetAllLocks = useEditorStore((s) => s.resetAllLocks);
  const setMasterFinger = useEditorStore((s) => s.setMasterFinger);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLock, setConfirmLock] = useState<FingerCode | null>(null);

  if (!doc) return null;
  const unlocked = FINGER_CODES.filter((f) => isFingerUnlocked(doc, f));
  const syncMode = unlocked.length === 0;

  return (
    <section className="rounded-panel border border-gray-200 bg-white p-3">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-800">十指编排</h3>
        <span className="text-[10px] text-gray-400">
          {syncMode ? '● 十指同步' : `○ 逐指解锁（${unlocked.length} 指独立）`}
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
              title={`${FINGER_LABEL[f]}${isMaster ? ' · 主视觉指' : ''}${isUnlocked ? ' · 已解锁' : ''}`}
              onClick={() => setCurrentFinger(f)}
              onDoubleClick={() => !readOnly && setMasterFinger(f)}
              className={cx(
                'relative flex flex-col items-center rounded-button border px-1 py-1.5 text-[10px] transition-colors duration-fast',
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

      <p className="mt-2 text-[10px] leading-4 text-gray-400">
        当前编辑：{currentFinger}（{FINGER_LABEL[currentFinger]}）
        {isFingerUnlocked(doc, currentFinger) ? ' · 独立数据' : ' · 与十指同步'}；双击指位设为主视觉指
      </p>

      {!readOnly && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {isFingerUnlocked(doc, currentFinger) ? (
            <Button size="sm" variant="secondary" onClick={() => setConfirmLock(currentFinger)}>
              <Lock size={12} />
              重新锁定 {currentFinger}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => unlockFinger(currentFinger)}>
              <LockOpen size={12} />
              解锁 {currentFinger} 独立编辑
            </Button>
          )}
          {unlocked.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={12} />
              全部重置
            </Button>
          )}
        </div>
      )}

      {/* 重新锁定：丢弃独立数据，回到同步 */}
      <Modal
        open={confirmLock !== null}
        onClose={() => setConfirmLock(null)}
        title={`重新锁定 ${confirmLock ?? ''}？`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmLock(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirmLock) lockFinger(confirmLock);
                setConfirmLock(null);
              }}
            >
              丢弃独立数据并锁定
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {confirmLock} 的独立编辑内容将被丢弃，该指回到十指同步数据。此操作可通过撤销（⌘Z）恢复。
        </p>
      </Modal>

      {/* 全部重置 */}
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="全部重置为十指同步？"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                resetAllLocks();
                setConfirmReset(false);
              }}
            >
              清除全部解锁
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          将清除 {unlocked.length} 个解锁指的独立数据，全部手指回到主视觉指同步数据。此操作可通过撤销（⌘Z）恢复。
        </p>
      </Modal>
    </section>
  );
}
