import type { ReactNode } from 'react';
import type { FingerCode } from '@/lib/types';
import { cx } from '@/design-system';

export interface NailGridProps {
  fingers: readonly FingerCode[];
  renderFinger(finger: FingerCode): ReactNode;
  density: 'preview' | 'compact';
  ariaLabel: string;
  className?: string;
}

/**
 * Shared ten-finger layout primitive. It owns reflow only; preview cards and
 * editor selection controls deliberately keep separate interaction contracts.
 */
export function NailGrid({ fingers, renderFinger, density, ariaLabel, className }: NailGridProps) {
  return (
    <div className={cx('nail-grid min-w-0 w-full', className)} data-density={density}>
      <div className="nail-grid__items" role="group" aria-label={ariaLabel}>
        {fingers.map((finger) => <div key={finger} className="min-w-0">{renderFinger(finger)}</div>)}
      </div>
    </div>
  );
}
