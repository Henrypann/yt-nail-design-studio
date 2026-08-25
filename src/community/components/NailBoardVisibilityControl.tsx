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
import {useLocale, type MessageKey} from '@/lib/i18n';
import type { NailBoardVisibilityV1 } from '../domain/v7_1/nail-board';

const OPTIONS: ReadonlyArray<{
  value: NailBoardVisibilityV1;
  icon: 'private' | 'unlisted' | 'public';
  labelKey: MessageKey;
  hintKey: MessageKey;
}> = [
  {
    value: 'PRIVATE',
    icon: 'private',
    labelKey: 'community.visibility.private',
    hintKey: 'community.visibility.privateHint',
  },
  {
    value: 'UNLISTED',
    icon: 'unlisted',
    labelKey: 'community.visibility.unlisted',
    hintKey: 'community.visibility.unlistedHint',
  },
  {
    value: 'PUBLIC',
    icon: 'public',
    labelKey: 'community.visibility.public',
    hintKey: 'community.visibility.publicHint',
  },
];

interface Props {
  visibility: NailBoardVisibilityV1;
  /** Report a transition. `publicConfirmed` is true only after the explicit modal. */
  onChange: (visibility: NailBoardVisibilityV1, publicConfirmed: boolean) => void;
  disabled?: boolean;
}

export function NailBoardVisibilityControl({ visibility, onChange, disabled }: Props) {
  const { t } = useLocale();
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
        {t('app.visibility')}
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
                {t(option.labelKey)}
              </span>
              <span className="text-xs text-gray-500">{t(option.hintKey)}</span>
            </span>
          </label>
        );
      })}

      <Modal
        open={pendingPublic}
        onClose={() => setPendingPublic(false)}
        title={t('app.makeBoardPublic')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" className="min-h-11" onClick={() => setPendingPublic(false)}>
              {t('app.cancel')}
            </Button>
            <Button
              variant="primary"
              className="min-h-11"
              data-testid="nail-board-public-confirm"
              onClick={confirmPublic}
            >
              {t('app.confirmPublic')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          {t('app.oncePublicAnyoneLinkCanViewBoardReadOnlyNeverEditAnonymouslyPublicContentMayBeIndexedShareLinksStayReadableContinue')}
        </p>
      </Modal>
    </fieldset>
  );
}
