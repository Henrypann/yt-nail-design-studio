/**
 * 品牌色板浮层（120 色 · OPI/CND/Essie）
 */

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cx } from '@/design-system';
import {
  loadBrandPalette,
  pushRecentColor,
  type BrandPaletteColor,
} from '../lib/material';
import { useEditorStore } from '../store';

type BrandFilter = 'all' | 'OPI' | 'CND' | 'Essie';

export function BrandPalettePopover(props: { onClose: () => void }) {
  const { onClose } = props;
  const setBrush = useEditorStore((s) => s.setBrush);
  const brushColor = useEditorStore((s) => s.brushColor);
  const [colors, setColors] = useState<BrandPaletteColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<BrandFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadBrandPalette()
      .then(setColors)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = colors;
    if (brand !== 'all') list = list.filter((c) => c.brand === brand);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q),
      );
    }
    return list;
  }, [colors, brand, query]);

  const pick = (hex: string) => {
    setBrush({ color: hex });
    pushRecentColor(hex);
  };

  return (
    <div
      className="absolute left-[calc(100%+8px)] top-0 z-50 flex w-52 flex-col rounded-panel border border-gray-200 bg-white shadow-modal animate-fade-in"
      data-testid="brand-palette-popover"
    >
      <header className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5">
        <span className="text-[11px] font-semibold text-gray-800">品牌色板</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-button p-0.5 text-gray-400 hover:bg-gray-100"
          aria-label="关闭色板"
        >
          <X size={14} />
        </button>
      </header>

      <div className="flex gap-0.5 border-b border-gray-100 p-1">
        {(['all', 'OPI', 'CND', 'Essie'] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBrand(b)}
            className={cx(
              'flex-1 rounded-button py-0.5 text-[9px]',
              brand === b ? 'bg-primary-soft text-primary' : 'text-gray-500 hover:bg-gray-50',
            )}
          >
            {b === 'all' ? '全部' : b}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="搜索色名/HEX"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mx-2 mt-1.5 rounded-button border border-gray-200 px-2 py-1 text-[10px]"
      />

      <div className="max-h-48 overflow-y-auto p-2">
        {loading ? (
          <p className="py-4 text-center text-[10px] text-gray-400">加载中…</p>
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                title={`${c.brand} · ${c.name}`}
                onClick={() => pick(c.hex)}
                className={cx(
                  'h-5 w-5 rounded-full border transition-transform duration-fast hover:scale-110',
                  brushColor.toLowerCase() === c.hex.toLowerCase()
                    ? 'ring-2 ring-primary ring-offset-1'
                    : 'border-gray-200',
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}
      </div>
      <p className="border-t border-gray-100 px-2 py-1 text-[9px] text-gray-400">
        {filtered.length} 色 · 异步加载
      </p>
    </div>
  );
}
