import { useEffect, useRef } from 'react';
import { Info, Ruler, UserRoundCheck, X } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';

export interface EditorStageContextDetailV7 {
  label: string;
  value: string;
}

export function EditorStageContextNoticeV7({
  context,
  title,
  description,
  details = [],
  source,
  disclaimer,
  onDismiss,
}: {
  context: 'geometry' | 'customer';
  title: string;
  description: string;
  details?: readonly EditorStageContextDetailV7[];
  source?: 'product' | 'generated' | 'generic';
  disclaimer?: string;
  onDismiss(): void;
}) {
  const { t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const Icon = context === 'geometry' ? Ruler : UserRoundCheck;

  useEffect(() => {
    closeRef.current?.focus();
  }, [context]);

  return (
    <section
      id={`editor-v7-stage-context-${context}`}
      role="region"
      aria-live="polite"
      aria-label={context === 'geometry' ? t('editorV7.workspace.stage.geometry') : t('editorV7.workspace.stage.customer')}
      data-testid="v7-stage-context"
      data-stage-context={context}
      data-geometry-source={context === 'geometry' ? source : undefined}
      className={cx(
        'border-b px-3 py-3 text-xs',
        context === 'geometry' && source !== 'product'
          ? 'border-amber-200 bg-amber-50 text-amber-950'
          : 'border-info/20 bg-info-soft text-info',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/75"><Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 max-w-4xl leading-5 opacity-90">{description}</p>
          {details.length > 0 && (
            <dl className="mt-2 flex flex-wrap gap-2">
              {details.map((detail) => (
                <div key={detail.label} className="min-w-[118px] rounded-xl border border-current/10 bg-white/75 px-3 py-2">
                  <dt className="text-nano opacity-60">{detail.label}</dt>
                  <dd className="mt-0.5 break-all font-mono text-nano font-semibold">{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {disclaimer && <p className="mt-2 flex items-start gap-1.5 text-nano leading-4 opacity-75"><Info size={12} className="mt-0.5 shrink-0" />{disclaimer}</p>}
        </div>
        <button ref={closeRef} type="button" aria-label={t('editor.extra.closeStageNotice')} onClick={onDismiss} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={15} /></button>
      </div>
    </section>
  );
}
