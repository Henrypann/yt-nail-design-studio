/**
 * Canonical Community Look → Studio import preflight.
 *
 * This page intentionally has no dependency on WizardPage, Wizard store, or
 * Wizard draft persistence. A versioned intent is either dismissed without
 * touching the current design, or materialized as an independent EditorDocV7
 * by the existing versioned-import consumer.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, cx, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { getLookReadModelById } from '@/community/data/look-repository';
import type { PublishedLookReadModelV1 } from '@/community/domain/v7_1/published-look-read-model';
import { sanitizeReturnTo } from '@/community/domain/studio-import-intent';
import type { VersionedStudioImportIntentV2 } from '@/community/domain/v7_1/versioned-studio-intent';
import {
  consumeVersionedUseIntentV2,
  persistFrenchUseContextForVersionedResultV1,
  versionedIntentPortV2,
} from '@/integration/community-studio/versioned-use-runtime';
import { deriveFrenchUsePreflightV1 } from '@/integration/community-studio/french-use-context-v1';

type PreflightState =
  | { kind: 'loading' }
  | { kind: 'ready'; intent: NonNullable<ReturnType<typeof versionedIntentPortV2.peek>>; look: PublishedLookReadModelV1 | null }
  | { kind: 'invalid'; message: string; returnTo: string }
  | { kind: 'error'; message: string; returnTo: string };

function failureMessage(reason: string): string {
  const messages: Record<string, string> = {
    missing_or_expired: '版本化导入意图已过期或不存在，请从 Community 重新开始。',
    permission: '该 Look 的访问权限已变化，导入已阻断。',
    look_unavailable: '该 Look 已下架或不再公开，导入已阻断。',
    version_mismatch: 'Look 当前指向了不同版本，未静默使用新版本。',
    source_mismatch: 'Look 发布者已变化，与来源 Creator lineage 不一致，导入已阻断。',
    release_unavailable: '固定版本发布记录不可用，导入已阻断。',
    asset_mismatch: '来源资产 revision/SHA-256 与发布版本不一致，导入已阻断。',
    asset_unavailable: '固定版本资产缺失，导入已阻断。',
    geometry_unavailable: '十指 geometry 尚未完整签收，无法创建独立 Editor 设计。',
    invalid_release: '固定版本发布记录校验失败，导入已阻断。',
    id_collision: '独立 Editor 设计 ID 冲突，未覆盖现有设计。',
    write_failed: 'Editor 设计写入失败；来源意图保留，可重试。',
    dependency: '导入依赖暂不可用；来源意图保留，可重试。',
  };
  return messages[reason] ?? '版本化导入校验失败，未修改当前设计。';
}

/**
 * Fixed-release imports need browser SHA-256 validation.  Web Crypto is only
 * exposed in a trusted context (HTTPS, or a browser-trusted localhost origin).
 * Keep this check separate from the import consumer so the operator sees the
 * actionable environment failure during preflight, before clicking New.
 */
export function hasTrustedVersionedImportRuntime(): boolean {
  return globalThis.isSecureContext === true
    && typeof globalThis.crypto?.subtle?.digest === 'function';
}

export default function VersionedImportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const intentId = searchParams.get('versionedIntent');
  const [state, setState] = useState<PreflightState>({ kind: 'loading' });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!intentId) {
      setState({ kind: 'invalid', message: '缺少 versionedIntent，未开始导入。', returnTo: Routes.community });
      return undefined;
    }
    let intent: VersionedStudioImportIntentV2 | null;
    try {
      intent = versionedIntentPortV2.peek(intentId);
    } catch {
      setState({ kind: 'error', message: '无法读取版本化导入意图；当前设计未修改，来源意图保留，可重试。', returnTo: Routes.community });
      return undefined;
    }
    if (!intent) {
      setState({ kind: 'invalid', message: failureMessage('missing_or_expired'), returnTo: Routes.community });
      return undefined;
    }
    const returnTo = sanitizeReturnTo(intent.returnTo, Routes.communityLook(intent.lookId));
    void getLookReadModelById(intent.lookId).then((look) => {
      if (cancelled) return;
      if (look?.readModelKind === 'CANONICAL' && look.sourceLook.creatorProfileId !== intent.sourceCreatorProfileId) {
        setState({ kind: 'invalid', message: failureMessage('source_mismatch'), returnTo });
        return;
      }
      setState({ kind: 'ready', intent, look });
    }).catch(() => {
      if (!cancelled) setState({ kind: 'ready', intent, look: null });
    });
    return () => { cancelled = true; };
  }, [intentId]);

  const ready = state.kind === 'ready' ? state : null;
  const returnTo = ready ? sanitizeReturnTo(ready.intent.returnTo, Routes.community) : Routes.community;
  const title = ready?.look?.title ?? ready?.intent.lookId ?? 'Community Look';
  // Intent provenance is the authority shown to the operator. The read model
  // publisher is only used above for an equality check and never replaces it.
  const creator = ready?.intent.sourceCreatorProfileId ?? '来源 Creator lineage 不可用';
  const assetCount = ready?.intent.assetRevisionRefs.length ?? 0;
  const frenchPreflight = useMemo(
    () => deriveFrenchUsePreflightV1(ready?.look?.discovery ?? null),
    [ready?.look?.discovery],
  );
  const trustedImportRuntime = hasTrustedVersionedImportRuntime();

  const action = async (mode: 'new' | 'current' | 'cancel') => {
    const active = state.kind === 'ready' ? state : null;
    if (!intentId || pending || !active) return;
    if (mode === 'new' && !trustedImportRuntime) {
      toast.warning('当前站点未启用受信任 HTTPS，无法校验固定版本；请使用 HTTPS 地址后重试。');
      return;
    }
    setPending(true);
    try {
      const result = await consumeVersionedUseIntentV2(intentId, mode);
      if (result.ok) {
        let frenchUseContextId: string | null = null;
        if (mode === 'new' && result.created && active.look?.readModelKind === 'CANONICAL') {
          const persisted = persistFrenchUseContextForVersionedResultV1({
            intent: active.intent,
            look: active.look,
            doc: result.doc,
          });
          if (persisted.ok) frenchUseContextId = persisted.context?.contextId ?? null;
          else toast.warning('完整 Look 已创建；法式技法提示不可用，Studio 未自动添加任何法式预设。');
        }
        navigate(mode === 'new' && result.created
          ? `${Routes.designCanvas}?design=${encodeURIComponent(result.doc.designId)}${frenchUseContextId ? `&frenchUseContext=${encodeURIComponent(frenchUseContextId)}` : ''}`
          : mode === 'current'
            ? Routes.designNew
            : sanitizeReturnTo(result.returnTo, returnTo), { replace: true });
        return;
      }
      setState({ kind: result.retryable ? 'error' : 'invalid', message: failureMessage(result.reason), returnTo });
      if (!result.retryable) toast.warning(failureMessage(result.reason));
    } catch {
      setState({ kind: 'error', message: failureMessage('dependency'), returnTo });
      toast.error(failureMessage('dependency'));
    } finally {
      setPending(false);
    }
  };

  const dismissFailureAndReturn = () => {
    const safeReturnTo = state.kind === 'ready'
      ? returnTo
      : ('returnTo' in state ? state.returnTo : Routes.community);
    if (!intentId) {
      navigate(safeReturnTo, { replace: true });
      return;
    }
    try {
      versionedIntentPortV2.clear(intentId);
      navigate(safeReturnTo, { replace: true });
    } catch {
      setState({
        kind: 'error',
        message: '无法清除版本化导入意图；当前设计未修改，来源意图保留，请重试或稍后处理。',
        returnTo: safeReturnTo,
      });
    }
  };

  const readiness = useMemo(() => {
    if (!ready) return [];
    return [
      { label: '固定来源版本', value: ready.intent.designVersionId, ok: true },
      { label: '发布者', value: creator, ok: Boolean(ready.look?.publisherId) },
      { label: '版本化资产', value: `${assetCount} 项，操作时严格复核 revision/SHA-256`, ok: true },
      { label: '十指 geometry', value: '操作时逐指严格复核；不完整则阻断', ok: true },
    ];
  }, [assetCount, creator, ready]);

  if (state.kind === 'loading') {
    return <div className="mx-auto max-w-2xl rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-600">正在读取版本化导入意图…</div>;
  }

  if (state.kind === 'invalid' || state.kind === 'error') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-card border border-amber-200 bg-white p-6" data-testid="versioned-import-error">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 text-amber-600" size={20} />
          <div><h1 className="text-lg font-semibold text-gray-900">无法导入此版本</h1><p className="mt-1 text-sm text-gray-600">{state.message}</p></div>
        </div>
        <div className="flex gap-2"><Button variant="secondary" onClick={dismissFailureAndReturn}>返回 Community</Button>{state.kind === 'error' && <Button onClick={() => window.location.reload()}>重试</Button>}</div>
      </div>
    );
  }

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="versioned-import-page">
      <button className="inline-flex min-h-11 min-w-11 items-center gap-1 text-xs text-gray-500 hover:text-gray-900" onClick={() => void action('cancel')} disabled={pending}>
        <ArrowLeft size={14} /> 返回 Community
      </button>
      <section className="rounded-card border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Import Preflight</p><h1 className="mt-1 text-xl font-semibold text-gray-900">{title}</h1><p className="mt-1 text-sm text-gray-500">来源：{creator}</p></div>
          <Badge variant="blue">固定版本</Badge>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {readiness.map((item) => <div key={item.label} className="flex items-start gap-2 rounded-panel border border-gray-100 bg-gray-50 px-3 py-2 text-xs"><CheckCircle2 size={14} className={cx(item.ok ? 'text-emerald-600' : 'text-amber-600')} /><span><strong className="font-medium text-gray-700">{item.label}</strong><br /><span className="text-gray-500">{item.value}</span></span></div>)}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-gray-500">新建会复制为独立 EditorDocV7；不会初始化或覆盖当前 Quick Start 草稿。预检通过不代表可制造或已下发生产。</p>
        {!trustedImportRuntime && (
          <div
            className="mt-3 rounded-panel border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
            data-testid="versioned-import-secure-context-warning"
            role="alert"
          >
            <strong className="font-medium">当前站点未启用受信任 HTTPS，无法校验固定版本</strong>
            <p className="mt-1 text-xs leading-relaxed">请使用 HTTPS 地址（localhost 开发地址也受支持）重新打开此页面，再新建独立 Editor 设计。返回 Community 或继续当前草稿仍可用。</p>
          </div>
        )}
        <div
          className="mt-3 rounded-panel border border-fuchsia-200 bg-fuchsia-50/60 p-3 text-xs text-fuchsia-950"
          data-testid="french-use-preflight"
          data-french-use-status={frenchPreflight.status}
        >
          <strong className="font-medium">法式技法提示</strong>
          {frenchPreflight.status === 'FRENCH_DECLARED' ? (
            <p className="mt-1 leading-relaxed">来源 discovery 明确包含「技法：法式」。导入的仍是完整 Look Remix；进入 Editor 后只会提示打开法式工具，不会猜测或自动写入经典、微、柔和、深或尖角预设。</p>
          ) : frenchPreflight.status === 'NOT_FRENCH' ? (
            <p className="mt-1 leading-relaxed">来源没有声明法式技法；Studio 不会根据标题、旧标签或画面外观猜测并打开法式工具。</p>
          ) : (
            <p className="mt-1 leading-relaxed text-amber-800">结构化 discovery 不可用；完整 Look 仍按固定版本预检，但法式工具提示保持关闭，不从 legacy 文案推断。</p>
          )}
          <p className="mt-1 text-nano text-fuchsia-800">此提示不代表当前可制作、物理验证或制造验证。</p>
        </div>
        {ready.intent.assetRevisionRefs.length > 0 && (
          <div className="mt-3 rounded-panel border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500" data-testid="versioned-import-assets">
            <strong className="font-medium text-gray-700">来源资产 refs</strong>
            <ul className="mt-1 space-y-1">
              {ready.intent.assetRevisionRefs.map((asset) => <li key={`${asset.assetId}:${asset.revision}`}>{asset.assetId} · rev {asset.revision} · SHA-256 {asset.sha256.slice(0, 12)}…</li>)}
            </ul>
          </div>
        )}
      </section>
      <section className="flex flex-wrap justify-end gap-2 rounded-card border border-gray-200 bg-white p-4">
        <Button variant="ghost" className="min-h-11 min-w-11 sm:w-auto" data-testid="versioned-import-cancel" disabled={pending} onClick={() => void action('cancel')}>返回 Community</Button>
        <Button variant="secondary" className="min-h-11 min-w-11 sm:w-auto" data-testid="versioned-import-current" disabled={pending} onClick={() => void action('current')}>继续当前草稿</Button>
        <Button loading={pending} className="min-h-11 min-w-11 sm:w-auto" data-testid="versioned-import-new" disabled={pending || !trustedImportRuntime} onClick={() => void action('new')}>新建独立 Editor 设计</Button>
      </section>
    </div>
  );
}
