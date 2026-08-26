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
import { useLocale } from '@/lib/i18n';
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

function failureMessage(reason: string, t: ReturnType<typeof useLocale>['t']): string {
  const messages: Record<string, string> = {
    missing_or_expired: t('wizard.intentExpired'),
    permission: t('validation.blocked'),
    look_unavailable: t('validation.blocked'),
    version_mismatch: t('validation.blocked'),
    source_mismatch: t('validation.blocked'),
    release_unavailable: t('validation.blocked'),
    asset_mismatch: t('wizard.intentAssetMismatch'),
    asset_unavailable: t('validation.blocked'),
    geometry_unavailable: t('versioned.geometry'),
    invalid_release: t('validation.blocked'),
    id_collision: t('validation.blocked'),
    write_failed: t('versioned.readFailed'),
    dependency: t('versioned.readFailed'),
  };
  return messages[reason] ?? t('validation.blocked');
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
  const { t } = useLocale();
  const intentId = searchParams.get('versionedIntent');
  const [state, setState] = useState<PreflightState>({ kind: 'loading' });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!intentId) {
      setState({ kind: 'invalid', message: t('versioned.missingIntent'), returnTo: Routes.community });
      return undefined;
    }
    let intent: VersionedStudioImportIntentV2 | null;
    try {
      intent = versionedIntentPortV2.peek(intentId);
    } catch {
      setState({ kind: 'error', message: t('versioned.readFailed'), returnTo: Routes.community });
      return undefined;
    }
    if (!intent) {
      setState({ kind: 'invalid', message: failureMessage('missing_or_expired', t), returnTo: Routes.community });
      return undefined;
    }
    const returnTo = sanitizeReturnTo(intent.returnTo, Routes.communityLook(intent.lookId));
    void getLookReadModelById(intent.lookId).then((look) => {
      if (cancelled) return;
      if (look?.readModelKind === 'CANONICAL' && look.sourceLook.creatorProfileId !== intent.sourceCreatorProfileId) {
        setState({ kind: 'invalid', message: failureMessage('source_mismatch', t), returnTo });
        return;
      }
      setState({ kind: 'ready', intent, look });
    }).catch(() => {
      if (!cancelled) setState({ kind: 'ready', intent, look: null });
    });
    return () => { cancelled = true; };
  }, [intentId, t]);

  const ready = state.kind === 'ready' ? state : null;
  const returnTo = ready ? sanitizeReturnTo(ready.intent.returnTo, Routes.community) : Routes.community;
  const title = ready?.look?.title ?? ready?.intent.lookId ?? t('community.lookTitleFallback');
  // Intent provenance is the authority shown to the operator. The read model
  // publisher is only used above for an equality check and never replaces it.
  const creator = ready?.intent.sourceCreatorProfileId ?? t('versioned.creatorUnavailable');
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
      toast.warning(t('versioned.secureContextAction'));
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
          else toast.warning(t('versioned.lookCreatedFrenchUnavailable'));
        }
        navigate(mode === 'new' && result.created
          ? `${Routes.designCanvas}?design=${encodeURIComponent(result.doc.designId)}${frenchUseContextId ? `&frenchUseContext=${encodeURIComponent(frenchUseContextId)}` : ''}`
          : mode === 'current'
            ? Routes.designNew
            : sanitizeReturnTo(result.returnTo, returnTo), { replace: true });
        return;
      }
      setState({ kind: result.retryable ? 'error' : 'invalid', message: failureMessage(result.reason, t), returnTo });
      if (!result.retryable) toast.warning(failureMessage(result.reason, t));
    } catch {
      setState({ kind: 'error', message: failureMessage('dependency', t), returnTo });
      toast.error(failureMessage('dependency', t));
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
        message: t('versioned.clearFailed'),
        returnTo: safeReturnTo,
      });
    }
  };

  const readiness = useMemo(() => {
    if (!ready) return [];
    return [
      { label: t('versioned.fixedSource'), value: ready.intent.designVersionId, ok: true },
      { label: t('versioned.publisher'), value: creator, ok: Boolean(ready.look?.publisherId) },
      { label: t('versioned.assetRefs'), value: t('versioned.assetRevision', { count: assetCount }), ok: true },
      { label: t('versioned.tenFinger'), value: t('versioned.geometry'), ok: true },
    ];
  }, [assetCount, creator, ready, t]);

  if (state.kind === 'loading') {
    return <div className="mx-auto max-w-2xl rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-600">{t('versioned.importLoading')}</div>;
  }

  if (state.kind === 'invalid' || state.kind === 'error') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-card border border-amber-200 bg-white p-6" data-testid="versioned-import-error">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 text-amber-600" size={20} />
          <div><h1 className="text-lg font-semibold text-gray-900">{t('versioned.importTitle')}</h1><p className="mt-1 text-sm text-gray-600">{state.message}</p></div>
        </div>
        <div className="flex gap-2"><Button variant="secondary" onClick={dismissFailureAndReturn}>{t('versioned.backCommunity')}</Button>{state.kind === 'error' && <Button onClick={() => window.location.reload()}>{t('versioned.retry')}</Button>}</div>
      </div>
    );
  }

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="versioned-import-page">
      <button className="inline-flex min-h-11 min-w-11 items-center gap-1 text-xs text-gray-500 hover:text-gray-900" onClick={() => void action('cancel')} disabled={pending}>
        <ArrowLeft size={14} /> {t('versioned.backCommunity')}
      </button>
      <section className="rounded-card border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('versioned.preflight')}</p><h1 className="mt-1 text-xl font-semibold text-gray-900">{title}</h1><p className="mt-1 text-sm text-gray-500">{t('versioned.source', { creator })}</p></div>
          <Badge variant="blue">{t('versioned.fixed')}</Badge>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {readiness.map((item) => <div key={item.label} className="flex items-start gap-2 rounded-panel border border-gray-100 bg-gray-50 px-3 py-2 text-xs"><CheckCircle2 size={14} className={cx(item.ok ? 'text-emerald-600' : 'text-amber-600')} /><span><strong className="font-medium text-gray-700">{item.label}</strong><br /><span className="text-gray-500">{item.value}</span></span></div>)}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-gray-500">{t('versioned.description')}</p>
        {!trustedImportRuntime && (
          <div
            className="mt-3 rounded-panel border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
            data-testid="versioned-import-secure-context-warning"
            role="alert"
          >
            <strong className="font-medium">{t('versioned.secureContextTitle')}</strong>
            <p className="mt-1 text-xs leading-relaxed">{t('versioned.secureContextDescription')}</p>
          </div>
        )}
        <div
          className="mt-3 rounded-panel border border-fuchsia-200 bg-fuchsia-50/60 p-3 text-xs text-fuchsia-950"
          data-testid="french-use-preflight"
          data-french-use-status={frenchPreflight.status}
        >
          <strong className="font-medium">{t('versioned.frenchHintTitle')}</strong>
          {frenchPreflight.status === 'FRENCH_DECLARED' ? (
            <p className="mt-1 leading-relaxed">{t('versioned.frenchDeclared')}</p>
          ) : frenchPreflight.status === 'NOT_FRENCH' ? (
            <p className="mt-1 leading-relaxed">{t('versioned.notFrench')}</p>
          ) : (
            <p className="mt-1 leading-relaxed text-amber-800">{t('versioned.discoveryUnavailable')}</p>
          )}
          <p className="mt-1 text-nano text-fuchsia-800">{t('versioned.notManufacturing')}</p>
        </div>
        {ready.intent.assetRevisionRefs.length > 0 && (
          <div className="mt-3 rounded-panel border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500" data-testid="versioned-import-assets">
            <strong className="font-medium text-gray-700">{t('versioned.assetRefs')}</strong>
            <ul className="mt-1 space-y-1">
              {ready.intent.assetRevisionRefs.map((asset) => (
                <li key={`${asset.assetId}:${asset.revision}`}>
                  {t('versioned.assetRefItem', {
                    assetId: asset.assetId,
                    revision: asset.revision,
                    sha: `${asset.sha256.slice(0, 12)}…`,
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="flex flex-wrap justify-end gap-2 rounded-card border border-gray-200 bg-white p-4">
        <Button variant="ghost" className="min-h-11 min-w-11 sm:w-auto" data-testid="versioned-import-cancel" disabled={pending} onClick={() => void action('cancel')}>{t('versioned.backCommunity')}</Button>
        <Button variant="secondary" className="min-h-11 min-w-11 sm:w-auto" data-testid="versioned-import-current" disabled={pending} onClick={() => void action('current')}>{t('wizard.applyCurrent')}</Button>
        <Button loading={pending} className="min-h-11 min-w-11 sm:w-auto" data-testid="versioned-import-new" disabled={pending || !trustedImportRuntime} onClick={() => void action('new')}>{t('versioned.createNewEditor')}</Button>
      </section>
    </div>
  );
}
