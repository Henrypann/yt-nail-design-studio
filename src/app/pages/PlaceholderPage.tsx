import { ReactNode } from 'react';
import { EmptyState } from '@/design-system';

/** 占位页骨架：模块开发代理替换为真实页面；统一提供标题 + 空状态 */
export function PlaceholderPage(props: {
  title: string;
  subtitle?: string;
  emptyTitle: string;
  emptyDescription?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">{props.title}</h1>
        {props.subtitle && <p className="mt-0.5 text-xs text-gray-500">{props.subtitle}</p>}
      </header>
      <EmptyState
        title={props.emptyTitle}
        description={props.emptyDescription}
        action={props.action}
        className="min-h-[320px]"
      />
    </div>
  );
}
