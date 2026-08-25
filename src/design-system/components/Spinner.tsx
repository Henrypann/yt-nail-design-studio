import { cx } from '../cx';
import { useLocale } from '@/lib/i18n';

export interface SpinnerProps {
  /** 直径 px，默认 16 */
  size?: number;
  className?: string;
}

/** 加载 spinner（页面级用 32px，按钮内用 14px） */
export function Spinner({ size = 16, className }: SpinnerProps) {
  const { t } = useLocale();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cx('shrink-0 animate-spin-slow', className)}
      role="progressbar"
      aria-label={t('common.loading')}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
