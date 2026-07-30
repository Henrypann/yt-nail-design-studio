/**
 * 调试面板（开发态 · v1.5.1，由 Mock 场景注入面板升级）
 *
 * 两个调试 tab + 一个独立需求说明抽屉：
 * 1. 场景 Mock —— 原 Mock 场景注入开关（render.failAll / save.fail / device.* …），
 *    消费方读 useMockScenarios()，UI 零改动切换「后端就绪后」能力；
 * 2. 元素 ID —— 扫描当前页面的 data-debug-id（页面/模块/弹窗映射代码的唯一 id），
 *    支持一键复制，提改进需求时直接引用；
 * 3. 需求说明 —— 独立浮动按钮打开源码反向 PRD 抽屉，不依赖 Mock 面板展开状态。
 *
 * 仅 import.meta.env.DEV 下渲染；Mock 开关持久化到 localStorage（刷新后可复现）。
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  FileCode2,
  FileText,
  LocateFixed,
  ScanSearch,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cx } from '@/design-system';
import { FINGER_CODES, type FingerCode } from './types';
import { MOCK_SCENARIOS, isScenarioOn, useMockScenarios } from './mock-panel';
import {
  flattenStudioRequirements,
  requirementLocator,
  requirementMarkdown,
  resolvePageRequirement,
  type ModuleRequirement,
  type PageRequirement,
  type RequirementStatus,
  type SourceRef,
} from './page-requirements';

type TabKey = 'mock' | 'ids';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mock', label: '场景 Mock' },
  { key: 'ids', label: '元素 ID' },
];

/* ── 一键复制 ── */

function CopyButton({
  text,
  label = '复制',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 剪贴板权限被拒：降级选中方案
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={copy}
      title={`复制 ${text}`}
      className={cx(
        'flex items-center gap-1 rounded-button border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 transition-colors duration-fast hover:bg-gray-50 hover:text-gray-800',
        copied && 'border-success text-success',
        className,
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? '已复制' : label}
    </button>
  );
}

/* ── Tab 1：场景 Mock（原 MockPanel 内容） ── */

function MockTab() {
  const flags = useMockScenarios((s) => s.flags);
  const failFinger = useMockScenarios((s) => s.failFinger);
  const toggle = useMockScenarios((s) => s.toggle);
  const setFailFinger = useMockScenarios((s) => s.setFailFinger);
  const reset = useMockScenarios((s) => s.reset);
  const groups = [...new Set(MOCK_SCENARIOS.map((s) => s.group))];

  return (
    <div>
      {groups.map((group) => (
        <div key={group} className="mb-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{group}</p>
          {MOCK_SCENARIOS.filter((s) => s.group === group).map((s) => (
            <label
              key={s.key}
              className="flex cursor-pointer items-start gap-2 rounded-button px-1 py-1 hover:bg-gray-50"
              title={s.description}
            >
              <input
                type="checkbox"
                checked={isScenarioOn(flags, s.key)}
                onChange={() => toggle(s.key)}
                className="mt-0.5 accent-[#C2497A]"
              />
              <span className="text-xs text-gray-700">{s.label}</span>
            </label>
          ))}
          {group === '渲染' && isScenarioOn(flags, 'render.failFinger') && (
            <div className="ml-6 mt-1 flex items-center gap-1">
              <span className="text-[10px] text-gray-500">失败指:</span>
              <select
                value={failFinger}
                onChange={(e) => setFailFinger(e.target.value as FingerCode)}
                className="rounded-button border border-gray-300 px-1 py-0.5 text-[10px]"
              >
                {FINGER_CODES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={reset}
        className="mt-1 w-full rounded-button border border-gray-200 py-1 text-[10px] text-gray-500 transition-colors duration-fast hover:bg-gray-50"
      >
        全部重置
      </button>
    </div>
  );
}

/* ── Tab 2：元素 ID（扫描 data-debug-id + 一键复制） ── */

interface DebugElement {
  id: string;
  hint: string;
}

function scanDebugElements(): DebugElement[] {
  const seen = new Map<string, string>();
  document.querySelectorAll<HTMLElement>('[data-debug-id]').forEach((el) => {
    const id = el.dataset.debugId;
    if (!id || seen.has(id)) return;
    const hint =
      el.getAttribute('aria-label') ??
      el.getAttribute('title') ??
      (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
    seen.set(id, hint);
  });
  return [...seen.entries()].map(([id, hint]) => ({ id, hint }));
}

function ElementIdsTab() {
  const location = useLocation();
  const [elements, setElements] = useState<DebugElement[]>([]);

  useEffect(() => {
    // 路由切换后等一帧让页面渲染完再扫描
    const timer = window.setTimeout(() => setElements(scanDebugElements()), 300);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] text-gray-400">页面/模块/弹窗的代码唯一 id（data-debug-id）</p>
        <button
          onClick={() => setElements(scanDebugElements())}
          className="flex items-center gap-1 rounded-button border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50"
        >
          <ScanSearch size={11} />
          重新扫描
        </button>
      </div>
      {elements.length === 0 && (
        <p className="py-4 text-center text-[11px] text-gray-400">当前页面未发现标注元素。</p>
      )}
      {elements.map((el) => (
        <div
          key={el.id}
          className="mb-1 flex items-center justify-between gap-2 rounded-button border border-gray-100 px-2 py-1.5 hover:border-gray-200"
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] text-gray-800">{el.id}</p>
            {el.hint && <p className="truncate text-[10px] text-gray-400">{el.hint}</p>}
          </div>
          <CopyButton text={el.id} className="shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ── 独立需求说明抽屉 ── */

const STATUS_META: Record<RequirementStatus, { label: string; className: string }> = {
  implemented: { label: '已实现', className: 'bg-success-soft text-success' },
  partial: { label: '部分实现', className: 'bg-warning-soft text-warning' },
  mock: { label: 'MOCK', className: 'bg-warning-soft text-warning' },
  gated: { label: '门禁中', className: 'bg-gray-100 text-gray-500' },
  deprecated: { label: '已废弃', className: 'bg-danger-soft text-danger' },
};

type AuditStatus = 'verified' | 'stale' | 'missing' | 'unreviewed' | 'checking';
interface AuditResult {
  ref: SourceRef;
  status: AuditStatus;
  message: string;
}

function RequirementSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h4 className="mb-1.5 text-[11px] font-semibold text-gray-800">{title}</h4>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2 text-[11px] leading-relaxed text-gray-600">
            <CircleDot className="mt-1 shrink-0 text-gray-300" size={9} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function highlightDebugElement(debugId: string): boolean {
  const element = document.querySelector<HTMLElement>(
    `[data-debug-id="${CSS.escape(debugId)}"]`,
  );
  if (!element) return false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  const previousOutline = element.style.outline;
  const previousOffset = element.style.outlineOffset;
  element.style.outline = '3px solid #C2497A';
  element.style.outlineOffset = '4px';
  window.setTimeout(() => {
    element.style.outline = previousOutline;
    element.style.outlineOffset = previousOffset;
  }, 1800);
  return true;
}

function SourceAudit({ refs }: { refs: SourceRef[] }) {
  const [results, setResults] = useState<AuditResult[]>(
    refs.map((ref) => ({ ref, status: 'checking', message: '核对中…' })),
  );

  useEffect(() => {
    let active = true;
    if (refs.length === 0) {
      setResults([]);
      return;
    }
    void import('./source-audit.dev').then(async ({ auditSourceRefs }) => {
      const next = await auditSourceRefs(refs);
      if (active) setResults(next);
    });
    return () => {
      active = false;
    };
  }, [refs]);

  if (results.length === 0) {
    return <p className="text-[10px] text-gray-400">当前记录尚未绑定源码证据。</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {results.map((result) => {
        const tone =
          result.status === 'verified'
            ? 'border-success/30 bg-success-soft text-success'
            : result.status === 'stale' || result.status === 'missing'
              ? 'border-warning/30 bg-warning-soft text-warning'
              : 'border-gray-200 bg-gray-50 text-gray-500';
        const Icon = result.status === 'verified' ? ShieldCheck : AlertTriangle;
        return (
          <div key={`${result.ref.path}#${result.ref.symbol}`} className={cx('rounded-button border p-2', tone)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[10px] font-medium">
                  <Icon size={11} />
                  {result.message}
                </p>
                <p className="mt-0.5 break-all font-mono text-[9px] opacity-75">
                  {result.ref.path}#{result.ref.symbol}
                </p>
              </div>
              <CopyButton text={`${result.ref.path}#${result.ref.symbol}`} className="shrink-0 bg-white" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RequirementsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const location = useLocation();
  const currentPage = useMemo(
    () => resolvePageRequirement(location.pathname),
    [location.pathname],
  );
  const allStudio = useMemo(() => flattenStudioRequirements(), []);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<{
    page: PageRequirement;
    module: ModuleRequirement;
  } | null>(null);
  const [locateMessage, setLocateMessage] = useState('');

  useEffect(() => {
    if (!open || !currentPage) return;
    const first = currentPage.modules[0];
    setSelection(first ? { page: currentPage, module: first } : null);
    setLocateMessage('');
  }, [open, currentPage]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!normalizedQuery) {
      if (!currentPage) return [];
      return currentPage.modules.map((item) => ({ page: currentPage, module: item }));
    }
    return allStudio.filter(({ page, module: item }) =>
      [
        page.title,
        page.pageId,
        item.id,
        item.debugId,
        item.name,
        item.summary,
        ...item.requirements,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [allStudio, currentPage, normalizedQuery]);

  if (!open) return null;

  return (
    <aside
      role="complementary"
      aria-label="Studio 需求说明"
      data-debug-id="app.requirements-drawer"
      className="fixed inset-y-0 right-0 z-[85] flex w-[min(520px,calc(100vw-24px))] flex-col border-l border-gray-200 bg-white shadow-modal"
    >
      <header className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <FileText size={16} className="text-primary" />
              Studio 需求说明
            </h2>
            <p className="mt-1 text-[10px] text-gray-400">源码反向 PRD · 代码变化只标记待复核</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-button p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="关闭需求说明"
          >
            <X size={16} />
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-button border border-gray-200 bg-gray-50 px-2.5 py-2">
          <Search size={13} className="text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模块、ID、功能或源码语义"
            className="min-w-0 flex-1 bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="清空搜索" className="text-gray-400">
              <X size={12} />
            </button>
          )}
        </label>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[190px_minmax(0,1fr)]">
        <nav className="min-h-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-2">
          {!normalizedQuery && currentPage && (
            <div className="mb-2 rounded-button border border-gray-200 bg-white p-2">
              <p className="text-[11px] font-semibold text-gray-800">{currentPage.title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-gray-500">{currentPage.goal}</p>
              <p className="mt-1 font-mono text-[9px] text-gray-400">{currentPage.pageId}</p>
            </div>
          )}
          <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            {normalizedQuery ? `全 Studio · ${visibleItems.length} 项` : '当前页面模块'}
          </p>
          {visibleItems.map(({ page, module: item }) => {
            const selected = selection?.module.id === item.id;
            const depth = item.parentId ? 1 : 0;
            return (
              <button
                key={`${page.pageId}:${item.id}`}
                onClick={() => {
                  setSelection({ page, module: item });
                  setLocateMessage('');
                }}
                className={cx(
                  'mb-1 flex w-full items-center gap-1.5 rounded-button py-2 pr-1.5 text-left',
                  depth ? 'pl-4' : 'pl-2',
                  selected ? 'bg-primary-soft text-primary' : 'text-gray-600 hover:bg-white',
                )}
              >
                <ChevronRight size={10} className="shrink-0 opacity-60" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium">{item.name}</span>
                  <span className="block truncate font-mono text-[9px] opacity-60">{item.id}</span>
                </span>
              </button>
            );
          })}
          {visibleItems.length === 0 && (
            <p className="px-2 py-5 text-center text-[10px] text-gray-400">没有匹配的 Studio 模块。</p>
          )}
        </nav>

        <main className="min-h-0 overflow-y-auto p-4">
          {selection ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-gray-900">{selection.module.name}</h3>
                    <span className={cx('rounded-full px-1.5 py-0.5 text-[9px]', STATUS_META[selection.module.status].className)}>
                      {STATUS_META[selection.module.status].label}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-gray-400">{selection.module.id}</p>
                </div>
                <CopyButton text={selection.module.id} className="shrink-0" />
              </div>

              <p className="mt-3 rounded-panel bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700">
                {selection.module.summary}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <CopyButton
                  text={requirementLocator(selection.page, selection.module)}
                  label="复制定位"
                  className="justify-center py-1.5"
                />
                <CopyButton
                  text={requirementMarkdown(selection.page, selection.module)}
                  label="复制 PRD"
                  className="justify-center py-1.5"
                />
              </div>
              <button
                onClick={() => {
                  const found = highlightDebugElement(selection.module.debugId);
                  setLocateMessage(found ? '已定位并高亮页面元素' : '当前视图未挂载该模块');
                }}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-button border border-gray-200 py-1.5 text-[10px] text-gray-600 hover:bg-gray-50"
              >
                <LocateFixed size={11} />
                定位页面元素
              </button>
              {locateMessage && (
                <p className={cx('mt-1 text-center text-[9px]', locateMessage.startsWith('已') ? 'text-success' : 'text-warning')}>
                  {locateMessage}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-4">
                <RequirementSection title="用户价值" items={selection.module.userValue} />
                <RequirementSection title="功能需求" items={selection.module.requirements} />
                <RequirementSection title="交互说明" items={selection.module.interactions} />
                <RequirementSection title="状态" items={selection.module.states} />
                <RequirementSection title="数据流" items={selection.module.dataFlow} />
                <RequirementSection title="异常与降级" items={selection.module.errors} />
                <RequirementSection title="约束与红线" items={selection.module.constraints} />
                <RequirementSection title="验收标准" items={selection.module.acceptance} />
                <section>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h4 className="text-[11px] font-semibold text-gray-800">源码证据</h4>
                    <span className="text-[9px] text-gray-400">复核于 {selection.module.reviewedAt}</span>
                  </div>
                  <SourceAudit refs={selection.module.sourceRefs} />
                </section>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
              <FileCode2 size={22} />
              <p className="mt-2 text-xs">选择一个模块查看源码反向 PRD。</p>
            </div>
          )}
        </main>
      </div>
    </aside>
  );
}

/* ── 面板壳 ── */

export function DebugPanel() {
  const flags = useMockScenarios((s) => s.flags);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<TabKey>('mock');
  const [requirementsOpen, setRequirementsOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  const activeCount = Object.values(flags).filter(Boolean).length;

  return (
    <>
      <button
        data-debug-id="app.requirements-launcher"
        onClick={() => setRequirementsOpen((value) => !value)}
        aria-expanded={requirementsOpen}
        aria-label="需求说明"
        title="需求说明"
        className={cx(
          'fixed bottom-4 left-[4.5rem] z-[75] flex h-10 w-10 items-center justify-center rounded-full border bg-white text-primary shadow-modal transition-colors hover:bg-primary-soft',
          requirementsOpen ? 'border-primary bg-primary-soft' : 'border-primary/30',
        )}
      >
        <FileText size={17} />
      </button>
      <RequirementsDrawer open={requirementsOpen} onClose={() => setRequirementsOpen(false)} />

      {/* 折叠态：左缘圆形收纳（不遮挡右下主操作区）；展开态：面板从圆钮上方弹出 */}
      <button
        data-debug-id="app.debug-panel"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label="调试面板"
        title="调试面板"
        className={cx(
          'fixed bottom-4 left-4 z-[70] flex h-10 w-10 items-center justify-center rounded-full border bg-white text-warning shadow-modal transition-colors hover:bg-warning-soft',
          expanded ? 'border-warning' : 'border-warning/40',
        )}
      >
        <Bug size={17} />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-warning px-1.5 text-[10px] text-white tnum">
            {activeCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className="fixed bottom-16 left-4 z-[70] w-72 rounded-panel border border-warning/40 bg-white shadow-modal">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <Bug size={14} />
              调试面板
              {activeCount > 0 && (
                <span className="rounded-full bg-warning px-1.5 text-[10px] text-white tnum">
                  {activeCount} Mock
                </span>
              )}
            </span>
            <button
              onClick={() => setExpanded(false)}
              aria-label="收起"
              className="rounded-button p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="border-t border-gray-200">
            <div className="flex gap-1 px-3 pt-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cx(
                    'rounded-full border px-2 py-0.5 text-[10px] transition-colors duration-fast',
                    tab === t.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-3 py-2">
              {tab === 'mock' && <MockTab />}
              {tab === 'ids' && <ElementIdsTab />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
