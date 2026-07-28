import { ReactNode } from 'react';
import { cx } from '../cx';

export interface TabItem {
  key: string;
  label: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

/** 页签（列表筛选等）：选中项主色下划线，150ms 过渡 */
export function Tabs({ items, activeKey, onChange, className }: TabsProps) {
  return (
    <div className={cx('flex items-center gap-1 border-b border-gray-200', className)} role="tablist">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cx(
              'relative -mb-px px-3 pb-2 pt-1 text-sm transition-colors duration-fast ease-out',
              active ? 'font-medium text-primary' : 'text-gray-500 hover:text-gray-800',
            )}
          >
            {item.label}
            <span
              className={cx(
                'absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary transition-opacity duration-fast',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
