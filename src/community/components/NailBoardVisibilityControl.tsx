/**
 * NailBoardVisibilityControl · COMM-V7.1-03
 *
 * Owner-side visibility control for a Nail Board:
 *  - PRIVATE  — default; only the owner can view. Never anonymously shareable.
 *  - UNLISTED — readable through an unguessable share link; not publicly indexed.
 *  - PUBLIC   — readable by link for everyone; still non-editable to anonymous
 *               viewers. Requires an EXPLICIT confirmation (modal) — a bare
 *               selection never flips a board public.
 *
 * The control only reports the desired transition via `onChange(visibility,
 * publicConfirmed)`; persistence and error handling stay in the parent page.
 * New touch targets are >= 44px and the whole group is keyboard accessible.
 */

import { useState } from 'react';
import { Eye, EyeOff, Link2 } from 'lucide-react';
import { Button, Modal, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { NailBoardVisibilityV1 } from '../domain/v7_1/nail-board';

const OPTIONS: ReadonlyArray<{
  value: NailBoardVisibilityV1;
  icon: 'private' | 'unlisted' | 'public';
  labelZh: string;
  labelEn: string;
  hintZh: string;
  hintEn: string;
}> = [
  {
    value: 'PRIVATE',
    icon: 'private',
    labelZh: '仅自己可见',
    labelEn: 'Private',
    hintZh: '默认。只有你能查看与编辑，无法生成匿名分享链接。',
    hintEn: 'Default. Only you can view and edit. Never anonymously shareable.',
  },
  {
    value: 'UNLISTED',
    icon: 'unlisted',
    labelZh: '不公开（链接分享）',
    labelEn: 'Unlisted',
    hintZh: '通过不可猜测的分享链接只读查看，不会被公开索引。',
    hintEn: 'Read-only via an unguessable share link; not publicly indexed.',
  },
  {
    value: 'PUBLIC',
    icon: 'public',
    labelZh: '公开',
    labelEn: 'Public',
    hintZh: '链接即可阅读，仍不可被匿名编辑。需要显式确认。',
    hintEn: 'Readable by link; still non-editable anonymously. Requires explicit confirmation.',
  },
];

interface Props {
  visibility: NailBoardVisibilityV1;
  /** Report a transition. `publicConfirmed` is true only after the explicit modal. */
  onChange: (visibility: NailBoardVisibilityV1, publicConfirmed: boolean) => void;
  disabled?: boolean;
}

export function NailBoardVisibilityControl({ visibility, onChange, disabled }: Props) {
  const { text } = useLocale();
  const [pendingPublic, setPendingPublic] = useState(false);

  const select = (next: NailBoardVisibilityV1) => {
    if (disabled || next === visibility) return;
    if (next === 'PUBLIC') {
      // Never flip public from a bare selection: require explicit confirmation.
      setPendingPublic(true);
      return;
    }
    onChange(next, false);
  };

  const confirmPublic = () => {
    setPendingPublic(false);
    onChange('PUBLIC', true);
  };

  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col gap-2"
      data-testid="nail-board-visibility-control"
    >
      <legend className="text-xs font-medium text-gray-700">
        {text('可见性', 'Visibility')}
      </legend>
      {OPTIONS.map((option) => {
        const active = visibility === option.value;
        return (
          <label
            key={option.value}
            className={cx(
              'flex cursor-pointer items-start gap-3 rounded-card border p-3 transition-colors',
              active
                ? 'border-primary/50 bg-primary-soft'
                : 'border-gray-200 bg-white hover:border-gray-300',
            )}
          >
            <input
              type="radio"
              name="nail-board-visibility"
              value={option.value}
              checked={active}
              disabled={disabled}
              onChange={() => select(option.value)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                {option.icon === 'private' ? (
                  <EyeOff size={14} aria-hidden className="text-gray-500" />
                ) : option.icon === 'unlisted' ? (
                  <Link2 size={14} aria-hidden className="text-gray-500" />
                ) : (
                  <Eye size={14} aria-hidden className="text-gray-500" />
                )}
                {text(option.labelZh, option.labelEn)}
              </span>
              <span className="text-xs text-gray-500">{text(option.hintZh, option.hintEn)}</span>
            </span>
          </label>
        );
      })}

      <Modal
        open={pendingPublic}
        onClose={() => setPendingPublic(false)}
        title={text('公开此 Board？', 'Make this board public?')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" className="min-h-11" onClick={() => setPendingPublic(false)}>
              {text('取消', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              className="min-h-11"
              data-testid="nail-board-public-confirm"
              onClick={confirmPublic}
            >
              {text('确认公开', 'Confirm public')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          {text(
            '公开后，任何拿到链接的人都可以只读查看此 Board（仍不可匿名编辑）。公开内容可能被收录与索引，且此操作会保留分享链接的公开可读性。确认继续？',
            'Once public, anyone with the link can view this board read-only (never edit anonymously). Public content may be indexed, and share links stay readable. Continue?',
          )}
        </p>
      </Modal>
    </fieldset>
  );
}
