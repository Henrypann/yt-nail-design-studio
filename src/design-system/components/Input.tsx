import { forwardRef, InputHTMLAttributes, useId } from 'react';
import { cx } from '../cx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** 字段下方红字（inline 错误） */
  error?: string;
  helper?: string;
}

/** 表单输入：label + inline 错误 + helper */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helper, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cx(
          'h-9 rounded-button border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400',
          'transition-colors duration-fast ease-out',
          error
            ? 'border-error focus:border-error'
            : 'border-gray-300 hover:border-gray-400 focus:border-primary',
          'focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50',
          className,
        )}
        aria-invalid={!!error}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-error">{error}</p>
      ) : helper ? (
        <p className="text-xs text-gray-500">{helper}</p>
      ) : null}
    </div>
  );
});
