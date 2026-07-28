import { HTMLAttributes } from 'react';
import { cx } from '../cx';

export type BadgeVariant =
  | 'gray'
  | 'blue'
  | 'deepBlue'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
  blue: 'bg-info-soft text-info border-info/20',
  deepBlue: 'bg-info text-white border-info',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  error: 'bg-error-soft text-error border-error/20',
  info: 'bg-info-soft text-info border-info/20',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** 状态徽标：draft 灰 / confirmed 蓝 / submitted 深蓝 等（DEV-PLAN §6.2） */
export function Badge({ variant = 'gray', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-button border px-1.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
