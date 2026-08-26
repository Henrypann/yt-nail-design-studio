import { Badge, type BadgeVariant } from '@/design-system';
import { useLocale, type MessageKey } from '@/lib/i18n';
import type { CommunityLookAssetCapabilityReadModelV1 } from '../domain/asset-capability-v1';

interface Props {
  capability: CommunityLookAssetCapabilityReadModelV1 | null | undefined;
  issueCodes?: readonly string[];
  locale: 'zh' | 'en';
}

const STATE_COPY = {
  VERSIONED_READY: {
    labelKey: 'community.capability.versionedReady',
    tone: 'success' as BadgeVariant,
    descriptionKey: 'community.capability.versionedReadyDescription',
  },
  LEGACY_APPROXIMATE: {
    labelKey: 'community.capability.legacyApproximate',
    tone: 'warning' as BadgeVariant,
    descriptionKey: 'community.capability.legacyApproximateDescription',
  },
  INSPIRATION_ONLY: {
    labelKey: 'community.capability.inspirationOnly',
    tone: 'gray' as BadgeVariant,
    descriptionKey: 'community.capability.inspirationOnlyDescription',
  },
  ASSETS_INCOMPLETE: {
    labelKey: 'community.capability.assetsIncomplete',
    tone: 'warning' as BadgeVariant,
    descriptionKey: 'community.capability.assetsIncompleteDescription',
  },
  UNAVAILABLE: {
    labelKey: 'community.capability.unavailable',
    tone: 'error' as BadgeVariant,
    descriptionKey: 'community.capability.unavailableDescription',
  },
} as const;

const DIAGNOSTICS: Record<string, MessageKey> = {
  exact_identity_lineage_only: 'community.capability.diagnosticExactIdentity',
  preview_is_approximate: 'community.capability.diagnosticPreviewApproximate',
  manufacturing_not_validated: 'community.capability.diagnosticManufacturingNotValidated',
  legacy_asset_ref_without_versioned_editor_doc: 'community.capability.diagnosticLegacyAssetRef',
  legacy_style_review_required: 'community.capability.diagnosticLegacyStyleReview',
  no_explicit_editable_asset_lineage: 'community.capability.diagnosticNoEditableLineage',
  asset_shape_coverage_decision_pending: 'community.capability.diagnosticShapeCoveragePending',
  rights_pending_public_use_blocked: 'community.capability.diagnosticRightsPending',
  draft_not_public: 'community.capability.diagnosticDraftNotPublic',
  creator_v1_fixture_not_public_authority: 'community.capability.diagnosticCreatorFixture',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 text-xs">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 break-all text-right font-medium text-gray-800">{value}</span>
    </div>
  );
}

function shortSha(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-6)}`;
}

export function CommunityAssetCapabilityBadge({
  capability,
  locale: _locale,
}: {
  capability: CommunityLookAssetCapabilityReadModelV1 | null;
  locale: 'zh' | 'en';
}) {
  const { t } = useLocale();
  if (!capability) {
    return (
      <Badge variant="warning" data-testid="community-asset-capability-badge" data-capability-state="UNAVAILABLE">
        {t('community.capability.unavailableBadge')}
      </Badge>
    );
  }
  const copy = STATE_COPY[capability.capabilityState];
  return (
    <Badge
      variant={copy.tone}
      data-testid="community-asset-capability-badge"
      data-capability-state={capability.capabilityState}
    >
      {t(copy.labelKey)}
    </Badge>
  );
}

export function CommunityAssetCapabilitySection({ capability, issueCodes = [], locale }: Props) {
  const { t } = useLocale();
  if (capability === undefined) {
    return (
      <section className="rounded-panel border border-gray-200 bg-gray-50 p-3" data-testid="community-asset-capability-loading">
        <p className="text-xs text-gray-500">{t('community.capability.loading')}</p>
      </section>
    );
  }
  if (capability === null) {
    return (
      <section className="rounded-panel border border-amber-200 bg-amber-50/60 p-3" data-testid="community-asset-capability-unavailable">
        <h2 className="text-sm font-semibold text-amber-900">{t('community.capability.unavailableTitle')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          {t('community.capability.unavailableDescription')}
        </p>
        {issueCodes.length > 0 && (
          <p
            className="mt-1 text-nano text-amber-700"
            data-testid="community-asset-capability-issues"
            data-issue-codes={issueCodes.join(',')}
          >
            {t('community.capability.unavailableDiagnostic')}
          </p>
        )}
      </section>
    );
  }

  const copy = STATE_COPY[capability.capabilityState];
  const lineage = capability.designVersionRef
    ? `${capability.designVersionRef.designVersionId} · Editor ${shortSha(capability.designVersionRef.editorDocSha256)}`
    : capability.legacyAssetRef
      ? `${capability.legacyAssetRef.templateId}@${capability.legacyAssetRef.assetVersion}`
      : t('community.capability.noEditableAssetReference');

  return (
    <section
      className="rounded-panel border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3"
      data-testid="community-asset-capability"
      data-capability-state={capability.capabilityState}
      data-capability-cta={capability.cta}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{t('community.capability.title')}</h2>
        <CommunityAssetCapabilityBadge capability={capability} locale={locale} />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">
        {t(copy.descriptionKey)}
      </p>
      <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-2">
        <Row label={t('community.capability.lineage')} value={lineage} />
        <Row label={t('community.capability.rights')} value={capability.rightsStatus} />
        <Row
          label={t('community.capability.currentMakeable')}
          value={capability.currentMakeable ? t('community.capability.yesEvidenceComplete') : t('community.capability.no')}
        />
        <Row
          label={t('community.capability.manufacturingValidation')}
          value={capability.manufacturingValidated ? t('community.capability.validated') : t('community.capability.noEvidence')}
        />
      </div>
      {capability.diagnostics.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs leading-relaxed text-gray-600" data-testid="community-asset-capability-diagnostics">
          {capability.diagnostics.map((code) => {
            const diagnostic = DIAGNOSTICS[code];
            return (
              <li key={code} data-diagnostic-code={code}>
                · {diagnostic ? t(diagnostic) : t('community.capability.unresolvedDiagnostic')}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
