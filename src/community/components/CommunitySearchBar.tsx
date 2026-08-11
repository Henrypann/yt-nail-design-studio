/**
 * CommunitySearchBar · 语义搜索表单（COMM-V7.1-02）。
 *
 * - `<form role="search">`，回车提交，搜索/清除按钮均 >= 44px（touch）。
 * - 输入框受控并随 URL 中的 q 同步；清除按钮同时清空输入与查询。
 * - 不写任何 store：仅通过 onSubmit 把查询交给 URL 状态。
 */

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useLocale } from '@/lib/i18n';
import { cx } from '@/design-system';

interface Props {
  value: string;
  onSubmit: (q: string) => void;
  placeholder?: string;
}

export function CommunitySearchBar({ value, onSubmit, placeholder }: Props) {
  const { text } = useLocale();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const submit = () => onSubmit(draft.trim());

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex w-full max-w-2xl gap-2"
      data-testid="community-search-bar"
    >
      <label htmlFor="community-search-input" className="sr-only">
        {text('搜索 Community', 'Search Community')}
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          id="community-search-input"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submit();
          }}
          placeholder={placeholder ?? text('搜索标题、风格、颜色、创作者…', 'Search title, style, color, creator…')}
          className="h-11 w-full rounded-button border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
        />
      </div>
      <button
        type="submit"
        data-testid="community-search-submit"
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-button bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {text('搜索', 'Search')}
      </button>
      {draft && (
        <button
          type="button"
          data-testid="community-search-clear"
          onClick={() => {
            setDraft('');
            onSubmit('');
          }}
          className={cx(
            'inline-flex h-11 shrink-0 items-center gap-1 rounded-button border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600',
            'hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          )}
        >
          <X size={14} aria-hidden />
          <span className="hidden sm:inline">{text('清除', 'Clear')}</span>
        </button>
      )}
    </form>
  );
}
