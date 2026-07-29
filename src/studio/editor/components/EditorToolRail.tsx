import { Brush, Gem, ImagePlus, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';

export type EditorToolSection = 'looks' | 'draw' | 'components' | 'import';

export function EditorToolRail(props: {
  active: EditorToolSection;
  drawerOpen: boolean;
  onSelect: (section: EditorToolSection) => void;
  onToggleDrawer: () => void;
}) {
  const { text } = useLocale();
  const items = [
    { id: 'looks', label: text('款式', 'Looks'), icon: Sparkles },
    { id: 'draw', label: text('绘制', 'Draw'), icon: Brush },
    { id: 'components', label: text('组件', 'Parts'), icon: Gem },
    { id: 'import', label: text('导入', 'Import'), icon: ImagePlus },
  ] as const;
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3" aria-label="Editor 工具">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          aria-label={item.label}
          aria-pressed={props.active === item.id && props.drawerOpen}
          onClick={() => props.onSelect(item.id)}
          className={cx(
            'flex h-10 w-10 flex-col items-center justify-center rounded-button text-[9px] transition-colors duration-fast',
            props.active === item.id && props.drawerOpen
              ? 'bg-primary-soft text-primary'
              : 'text-gray-500 hover:bg-gray-100',
          )}
        >
          <item.icon size={16} />
          <span>{item.label}</span>
        </button>
      ))}
      <button
        type="button"
        title={props.drawerOpen ? text('收起工具面板', 'Collapse tools') : text('展开工具面板', 'Expand tools')}
        onClick={props.onToggleDrawer}
        className="mt-auto flex h-9 w-9 items-center justify-center rounded-button text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        {props.drawerOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </button>
    </nav>
  );
}
