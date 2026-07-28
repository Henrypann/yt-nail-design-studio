import { ReactNode } from 'react';
import { cx } from '../cx';

export interface EmptyStateProps {
  /** 插画或图标节点（资产管线插图到位后传入） */
  illustration?: ReactNode;
  title: string;
  description?: string;
  /** 主操作按钮等 */
  action?: ReactNode;
  className?: string;
}

/** 空状态：插画 + 标题 + 描述 + 操作（PRD §6.2） */
export function EmptyState({ illustration, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-gray-300 bg-white px-6 py-12 text-center',
        className,
      )}
    >
      {illustration && <div className="mb-2 text-gray-300">{illustration}</div>}
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="max-w-[360px] text-xs text-gray-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
