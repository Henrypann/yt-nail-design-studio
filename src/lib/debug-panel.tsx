/**
 * 调试面板（开发态 · v1.5.1，由 Mock 场景注入面板升级）
 *
 * 三个 tab：
 * 1. 场景 Mock —— 原 Mock 场景注入开关（render.failAll / save.fail / device.* …），
 *    消费方读 useMockScenarios()，UI 零改动切换「后端就绪后」能力；
 * 2. 元素 ID —— 扫描当前页面的 data-debug-id（页面/模块/弹窗映射代码的唯一 id），
 *    支持一键复制，提改进需求时直接引用；
 * 3. 需求说明 —— 当前页面的需求描述（src/lib/page-requirements.ts），
 *    点击模块弹出「需求 / 交互 / 逻辑」详情，所见即所得，无需切换 PRD 查验。
 *
 * 仅 import.meta.env.DEV 下渲染；Mock 开关持久化到 localStorage（刷新后可复现）。
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, Check, ChevronDown, ChevronUp, Copy, FileText, ScanSearch, X } from 'lucide-react';
import { cx } from '@/design-system';
import { FINGER_CODES, type FingerCode } from './types';
import { MOCK_SCENARIOS, isScenarioOn, useMockScenarios } from './mock-panel';
import { resolvePageRequirement, type ModuleRequirement } from './page-requirements';

type TabKey = 'mock' | 'ids' | 'requirements';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mock', label: '场景 Mock' },
  { key: 'ids', label: '元素 ID' },
  { key: 'requirements', label: '需求说明' },
];

/* ── 一键复制 ── */

function CopyButton({ text, className }: { text: string; className?: string }) {
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
      {copied ? '已复制' : '复制'}
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

/* ── Tab 3：需求说明（当前页面 + 模块详情弹窗） ── */

function RequirementsTab() {
  const location = useLocation();
  const page = useMemo(() => resolvePageRequirement(location.pathname), [location.pathname]);
  const [detail, setDetail] = useState<ModuleRequirement | null>(null);

  if (!page) {
    return <p className="py-4 text-center text-[11px] text-gray-400">当前页面暂无需求描述。</p>;
  }

  return (
    <div>
      <div className="mb-2 rounded-panel bg-gray-50 p-2.5">
        <p className="text-xs font-semibold text-gray-900">
          {page.title}
          <span className="ml-1.5 font-mono text-[10px] font-normal text-gray-400">{page.pageId}</span>
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-600">{page.goal}</p>
        <p className="mt-1 text-[10px] text-gray-400">依据：{page.refs.join(' · ')}</p>
      </div>

      {page.modules.map((m) => (
        <button
          key={m.name}
          onClick={() => setDetail(m)}
          className="mb-1.5 flex w-full items-center justify-between gap-2 rounded-button border border-gray-100 px-2.5 py-2 text-left transition-colors duration-fast hover:border-primary/40 hover:bg-primary-soft/40"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-gray-800">{m.name}</p>
            {m.debugId && <p className="truncate font-mono text-[10px] text-gray-400">{m.debugId}</p>}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-primary">
            <FileText size={11} />
            需求详情
          </span>
        </button>
      ))}

      {/* 模块需求详情弹窗 */}
      {detail && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`需求详情 · ${detail.name}`}
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-[520px] overflow-y-auto rounded-panel bg-white p-5 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{detail.name}</h3>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {page.title}
                  {detail.debugId ? ` · ${detail.debugId}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {detail.debugId && <CopyButton text={detail.debugId} />}
                <button
                  onClick={() => setDetail(null)}
                  className="rounded-button p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="关闭"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {(
              [
                ['模块需求', detail.requirements],
                ['交互说明', detail.interactions],
                ['逻辑与红线', detail.logic],
              ] as const
            ).map(([title, items]) => (
              <div key={title} className="mb-3">
                <p className="mb-1 text-[11px] font-semibold text-gray-700">{title}</p>
                <ul className="flex flex-col gap-1">
                  {items.map((item, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-gray-600">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="border-t border-gray-100 pt-2 text-[10px] text-gray-400">
              数据源：src/lib/page-requirements.ts（agent & human friendly；冲突以 DEV-PLAN 仲裁规则为准）
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 面板壳 ── */

export function DebugPanel() {
  const flags = useMockScenarios((s) => s.flags);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<TabKey>('mock');

  if (!import.meta.env.DEV) return null;

  const activeCount = Object.values(flags).filter(Boolean).length;

  return (
    <div data-debug-id="app.debug-panel" className="fixed bottom-4 right-4 z-[70] w-72 rounded-panel border border-warning/40 bg-white shadow-modal">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-warning">
          <Bug size={14} />
          调试面板
          {activeCount > 0 && (
            <span className="rounded-full bg-warning px-1.5 text-[10px] text-white tnum">
              {activeCount} Mock
            </span>
          )}
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {expanded && (
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
            {tab === 'requirements' && <RequirementsTab />}
          </div>
        </div>
      )}
    </div>
  );
}
