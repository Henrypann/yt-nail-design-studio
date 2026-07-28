import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cx } from '../cx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active disabled:bg-gray-300',
  secondary:
    'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 disabled:text-gray-400',
  danger:
    'bg-error text-white hover:opacity-90 active:opacity-80 disabled:bg-gray-300',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
};

/** 主按钮 / 次按钮 / 幽灵按钮 / 危险按钮，内置 loading spinner + 禁用态 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center gap-1.5 rounded-button font-medium',
        'transition-colors duration-fast ease-out',
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) && 'cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
});
