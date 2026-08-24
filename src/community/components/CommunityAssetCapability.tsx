import { Badge, type BadgeVariant } from '@/design-system';
import type { CommunityLookAssetCapabilityReadModelV1 } from '../domain/asset-capability-v1';

interface Props {
  capability: CommunityLookAssetCapabilityReadModelV1 | null | undefined;
  issueCodes?: readonly string[];
  locale: 'zh' | 'en';
}

const STATE_COPY = {
  VERSIONED_READY: {
    zh: '版本化可编辑',
    en: 'Versioned editable',
    tone: 'success' as BadgeVariant,
    descriptionZh: 'DesignVersion、EditorDoc SHA 与预览 SHA 的身份血缘完整。',
    descriptionEn: 'DesignVersion, EditorDoc SHA and preview SHA identity lineage is complete.',
  },
  LEGACY_APPROXIMATE: {
    zh: '旧版近似应用',
    en: 'Legacy approximate',
    tone: 'warning' as BadgeVariant,
    descriptionZh: '保留显式旧版模板引用；缺少不可变 DesignVersion / EditorDoc SHA 链。',
    descriptionEn: 'An explicit legacy template remains, without immutable DesignVersion / EditorDoc SHA lineage.',
  },
  INSPIRATION_ONLY: {
    zh: '仅供灵感',
    en: 'Inspiration only',
    tone: 'gray' as BadgeVariant,
    descriptionZh: '只支持查看、收藏或比较，不提供编辑动作。',
    descriptionEn: 'View, save and compare only; no editing action is available.',
  },
  ASSETS_INCOMPLETE: {
    zh: '资产不完整',
    en: 'Assets incomplete',
    tone: 'warning' as BadgeVariant,
    descriptionZh: '内容可查看，但没有完整、可追溯的编辑资产血缘。',
    descriptionEn: 'The content is viewable, but editable asset lineage is incomplete.',
  },
  UNAVAILABLE: {
    zh: '当前不可用',
    en: 'Unavailable',
    tone: 'error' as BadgeVariant,
    descriptionZh: '版权、公开状态或技术决策阻止使用；不会自动放宽。',
    descriptionEn: 'Rights, publication or a technical decision blocks use; no automatic relaxation.',
  },
} as const;

const DIAGNOSTICS: Record<string, { zh: string; en: string }> = {
  exact_identity_lineage_only: {
    zh: 'EXACT 仅指版本与 SHA 身份链完整。',
    en: 'EXACT refers only to complete version and SHA identity lineage.',
  },
  preview_is_approximate: {
    zh: '当前预览仍为 APPROXIMATE（数字模拟）。',
    en: 'The current preview remains APPROXIMATE (digital simulation).',
  },
  manufacturing_not_validated: {
    zh: '没有物理或制造验证。',
    en: 'No physical or manufacturing validation.',
  },
  legacy_asset_ref_without_versioned_editor_doc: {
    zh: '旧版资产缺少不可变 EditorDoc SHA，进入 Studio 时按近似处理。',
    en: 'The legacy asset has no immutable EditorDoc SHA and is treated as approximate.',
  },
  legacy_style_review_required: {
    zh: '整体风格仍待人工复核；法式只作为技法条件。',
    en: 'Overall style still needs review; French remains a technique condition only.',
  },
  no_explicit_editable_asset_lineage: {
    zh: '未找到显式可编辑资产血缘，只提供查看。',
    en: 'No explicit editable asset lineage is available; view only.',
  },
  asset_shape_coverage_decision_pending: {
    zh: '甲型覆盖与资产路径尚未签收，当前不可用。',
    en: 'Shape coverage and asset routing are awaiting sign-off; currently unavailable.',
  },
  rights_pending_public_use_blocked: {
    zh: '版权状态待确认，公开使用已关闭。',
    en: 'Rights are pending, so public use is blocked.',
  },
  draft_not_public: {
    zh: '内部草稿不可公开使用。',
    en: 'An internal draft cannot be used publicly.',
  },
  creator_v1_fixture_not_public_authority: {
    zh: 'Creator V1 fixture 不是公开发布权威。',
    en: 'The Creator V1 fixture is not a public publication authority.',
  },
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
  locale,
}: {
  capability: CommunityLookAssetCapabilityReadModelV1 | null;
  locale: 'zh' | 'en';
}) {
  if (!capability) {
    return (
      <Badge variant="warning" data-testid="community-asset-capability-badge" data-capability-state="UNAVAILABLE">
        {locale === 'zh' ? '能力不可用' : 'Capability unavailable'}
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
      {locale === 'zh' ? copy.zh : copy.en}
    </Badge>
  );
}

export function CommunityAssetCapabilitySection({ capability, issueCodes = [], locale }: Props) {
  const zh = locale === 'zh';
  if (capability === undefined) {
    return (
      <section className="rounded-panel border border-gray-200 bg-gray-50 p-3" data-testid="community-asset-capability-loading">
        <p className="text-xs text-gray-500">{zh ? '资产能力与血缘加载中…' : 'Loading asset capability and lineage…'}</p>
      </section>
    );
  }
  if (capability === null) {
    return (
      <section className="rounded-panel border border-amber-200 bg-amber-50/60 p-3" data-testid="community-asset-capability-unavailable">
        <h2 className="text-sm font-semibold text-amber-900">{zh ? '资产能力不可用' : 'Asset capability unavailable'}</h2>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          {zh
            ? '能力合同加载或校验失败；本页不会根据旧标签猜测可编辑性，也不会提供内容应用动作。'
            : 'The capability contract failed to load or validate. Editability is not inferred from legacy labels and content-use actions stay disabled.'}
        </p>
        {issueCodes.length > 0 && (
          <p
            className="mt-1 text-nano text-amber-700"
            data-testid="community-asset-capability-issues"
            data-issue-codes={issueCodes.join(',')}
          >
            {zh ? '诊断：资产能力数据暂不可用。' : 'Diagnostic: asset capability data is temporarily unavailable.'}
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
      : zh ? '无可编辑资产引用' : 'No editable asset reference';

  return (
    <section
      className="rounded-panel border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3"
      data-testid="community-asset-capability"
      data-capability-state={capability.capabilityState}
      data-capability-cta={capability.cta}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{zh ? '资产能力与版本血缘' : 'Asset capability & version lineage'}</h2>
        <CommunityAssetCapabilityBadge capability={capability} locale={locale} />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">
        {zh ? copy.descriptionZh : copy.descriptionEn}
      </p>
      <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-2">
        <Row label={zh ? '血缘' : 'Lineage'} value={lineage} />
        <Row label={zh ? '版权' : 'Rights'} value={capability.rightsStatus} />
        <Row
          label={zh ? '当前可制作' : 'Currently makeable'}
          value={capability.currentMakeable ? (zh ? '是（证据链完整）' : 'Yes (evidence complete)') : (zh ? '否' : 'No')}
        />
        <Row
          label={zh ? '制造验证' : 'Manufacturing validation'}
          value={capability.manufacturingValidated ? (zh ? '已验证' : 'Validated') : (zh ? '无证据' : 'No evidence')}
        />
      </div>
      {capability.diagnostics.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs leading-relaxed text-gray-600" data-testid="community-asset-capability-diagnostics">
          {capability.diagnostics.map((code) => {
            const diagnostic = DIAGNOSTICS[code];
            return (
              <li key={code} data-diagnostic-code={code}>
                · {diagnostic ? (zh ? diagnostic.zh : diagnostic.en) : (zh ? '存在未解析的能力限制。' : 'An unresolved capability limitation exists.')}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
