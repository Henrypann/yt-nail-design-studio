import { HTMLAttributes } from 'react';
import { cx } from '../cx';

/** 脉动骨架屏块（1.2s 脉动） */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-panel bg-gray-200 animate-skeleton-pulse', className)}
      aria-hidden="true"
      {...rest}
    />
  );
}

/** 列表骨架：默认 3 行灰色占位条（PRD §6.1：3-5 行） */
export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-3', className)} aria-label="加载中">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
