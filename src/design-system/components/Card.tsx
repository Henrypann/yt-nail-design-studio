import { HTMLAttributes } from 'react';
import { cx } from '../cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 是否加悬浮阴影 */
  elevated?: boolean;
  /** 内边距档位 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

/** 卡片容器：白底 + 12px 圆角 + 1px 灰描边，可选悬浮阴影 */
export function Card({
  elevated = false,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        'rounded-card border border-gray-200 bg-white',
        elevated && 'shadow-float',
        paddingClasses[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
