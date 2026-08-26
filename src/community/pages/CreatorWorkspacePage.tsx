import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, Eye, EyeOff, FilePlus2, LockKeyhole, Send, Sparkles } from 'lucide-react';
import { Button, Input, Tabs, useToast } from '@/design-system';
import {useLocale, localizedLabel, type MessageKey, type MessageParams} from '@/lib/i18n';
import { CANONICAL_USE_DEMO_RELEASE_RECORD_V1 } from '@/integration/community-studio/canonical-use-demo';
import { creatorWorkspaceServiceV1, ensureCanonicalDemoPublishAuthorityV1 } from '@/integration/community-studio/backend-runtime';
import { Routes } from '@/app/routes';
import type { CreatorPublicationDraftPatchV1 } from '@/platform/backend';
import {
  createEmptyCreatorPublicationStoreV2,
  type CreatorDiscoveryAuthoringV2,
  type CreatorPublicationDraftV2,
  type CreatorPublicationStoreV2,
} from '../domain/v7_1/creator-publication-v2';
import { emptyGovernanceStoreV1, type GovernanceStoreV1 } from '../domain/v7_1/governance';
import { loadCommunityTaxonomyV2 } from '../data/taxonomy-repository';
import {
  MAKEABILITY_CLASSIFICATION_TAGS,
  MAKEABILITY_CLASSIFICATIONS,
  RIGHTS_STATUS_TAGS,
  RIGHTS_STATUSES,
  type MakeabilityClassification,
  type RightsStatus,
} from '../domain/taxonomy-v2/contract';
import { resolveTagId } from '../domain/taxonomy-v2/resolve';
import type { BilingualLabelsV2, CommunityTaxonomyV2 } from '../domain/taxonomy-v2/types';

export default function CreatorWorkspacePage() {
  const { t } = useLocale();
  const toast = useToast();
  const [store, setStore] = useState<CreatorPublicationStoreV2>(createEmptyCreatorPublicationStoreV2);
  const [tab, setTab] = useState('drafts');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [governance, setGovernance] = useState<GovernanceStoreV1>(emptyGovernanceStoreV1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<CommunityTaxonomyV2 | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const actionLock = useRef(false);
  const updateQueue = useRef(Promise.resolve());
  const active = store.drafts.find((item) => item.draftId === activeId) ?? null;

  const applyState = (value: { publication: CreatorPublicationStoreV2; governance: GovernanceStoreV1 }) => {
    setStore(value.publication); setGovernance(value.governance); setLoadError(null);
  };
  useEffect(() => {
    let alive = true;
    void creatorWorkspaceServiceV1.load().then((result) => {
      if (!alive) return;
      if (result.ok) applyState(result.value); else setLoadError(result.error.reason);
    });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    void loadCommunityTaxonomyV2().then((result) => {
      if (!alive) return;
      if (result.ok) setTaxonomy(result.taxonomy);
      else setTaxonomyError(result.issues.map((issue) => `${issue.code}@${issue.path}: ${issue.message}`).join('; '));
    });
    return () => { alive = false; };
  }, []);

  const startDraft = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      const authority = await ensureCanonicalDemoPublishAuthorityV1();
      if (!authority.ok) { toast.error(`${t('auth.publishAssetsNotReady')}: ${authority.error.reason}`); return; }
      const created = await creatorWorkspaceServiceV1.createDraft(CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.designVersionId);
      if (!created.ok) { toast.error(`${t('app.couldNotCreatePublicationDraft')}: ${created.error.reason}`); return; }
      applyState(created.value); setActiveId(created.value.draftId); setTab('drafts');
      toast.success(t('app.privatePublicationDraftCreated'));
    } catch { toast.error(t('app.couldNotCreatePublishPackage')); }
    finally { actionLock.current = false; setBusy(false); }
  };

  const update = (patch: CreatorPublicationDraftPatchV1) => {
    if (!active || actionLock.current) return;
    const draftId = active.draftId;
    setStore((current) => ({ ...current, drafts: current.drafts.map((draft) => draft.draftId === draftId ? { ...draft, ...patch } : draft) }));
    updateQueue.current = updateQueue.current.catch(() => undefined).then(async () => {
      const result = await creatorWorkspaceServiceV1.updateDraft(draftId, patch);
      if (!result.ok) {
        toast.warning(result.error.reason);
        const recovered = await creatorWorkspaceServiceV1.load(); if (recovered.ok) applyState(recovered.value);
        return;
      }
      applyState(result.value);
    });
  };

  const publish = async () => {
    if (!active || actionLock.current) return;
    actionLock.current = true;
    setActionBusy(true);
    try {
      await updateQueue.current;
      const result = await creatorWorkspaceServiceV1.publishDraft(active.draftId);
      if (!result.ok) { toast.warning(`${t('app.completeTitleSourceCopyrightDeclarations')}: ${result.error.reason}`); return; }
      applyState(result.value); setActiveId(null); setTab('published'); toast.success(t('app.publishedCreatorLibrary'));
    } finally { actionLock.current = false; setActionBusy(false); }
  };
  const submitReview=async()=>{if(!active||actionLock.current)return;actionLock.current=true;setActionBusy(true);try{await updateQueue.current;const result=await creatorWorkspaceServiceV1.submitReview(active.draftId);if(!result.ok){toast.error(`${t('app.reviewSubmissionFailed')}: ${result.error.reason}`);return}applyState(result.value);toast.success(t('app.publicReviewSubmitted'));}finally{actionLock.current=false;setActionBusy(false);}};

  const toggleHidden = async (lookId: string, hidden: boolean) => {
    if(actionLock.current)return;actionLock.current=true;setActionBusy(true);try{const result = await creatorWorkspaceServiceV1.setLookHidden(lookId, hidden);
    if (!result.ok) { toast.error(result.error.reason); return; }
    applyState(result.value); toast.success(hidden ? t('app.lookHidden') : t('app.lookRestored'));}finally{actionLock.current=false;setActionBusy(false);}
  };
  const shareLook = async (designVersionId:string) => {
    if(actionLock.current)return;actionLock.current=true;setActionBusy(true);try{const created=await creatorWorkspaceServiceV1.createClientShare(designVersionId);
    if(!created.ok){toast.error(`${t('app.couldNotCreateShare')}: ${created.error.reason}`);return;}
    const url=new URL(Routes.communityClientShare(created.value.rawToken),window.location.origin).toString();await navigator.clipboard?.writeText(url);toast.success(t('community.clientApprovalLinkCopied7Days'));}finally{actionLock.current=false;setActionBusy(false);}
  };

  const visibleLooks = store.looks.filter((look) => tab === 'hidden' ? look.status === 'HIDDEN' : look.status === 'PUBLISHED');
  return (
    <div className="space-y-5" data-testid="creator-workspace-page">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-primary/15 bg-gradient-to-br from-white to-primary-soft p-5">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('community.creatorWorkspacePrototype')}</p><h1 className="mt-1 text-h1 font-bold text-ink">{t('app.publishManageLooks')}</h1><p className="mt-2 max-w-2xl text-sm text-body">{t('app.createLooksFixedDesignversionPublishPackagePrivateUnlistedOnlyPublicRequiresGovernance')}</p></div>
        <Button onClick={startDraft} loading={busy} disabled={busy||actionBusy} className="min-h-11"><FilePlus2 size={16} />{t('app.newPublication')}</Button>
      </header>
      {loadError && <p role="alert" className="rounded-card border border-error/30 bg-error/5 p-3 text-sm text-error">{t('app.publicationServiceUnavailableExistingDataWasNotOverwritten')} <span className="font-mono">{loadError}</span></p>}
      <Tabs activeKey={tab} onChange={setTab} items={[{key:'drafts',label:`${t('app.drafts')} ${store.drafts.length}`},{key:'published',label:`${t('app.published')} ${store.looks.filter((l)=>l.status==='PUBLISHED').length}`},{key:'hidden',label:`${t('app.hidden')} ${store.looks.filter((l)=>l.status==='HIDDEN').length}`}]} />
      {active ? <PublishWizard draft={active} busy={actionBusy} governanceStatus={governance.publicationReviews.slice().reverse().find(review=>review.draftId===active.draftId&&review.draftRevision===active.contentRevision)?.status} taxonomy={taxonomy} taxonomyError={taxonomyError} onSubmitReview={submitReview} onUpdate={update} onPublish={publish} onClose={() => setActiveId(null)} t={t} /> : tab === 'drafts' ? (
        <CardGrid empty={t('app.noPublicationDraftsYet')}>
          {store.drafts.map((draft) => <button key={draft.draftId} onClick={()=>setActiveId(draft.draftId)} className="min-h-32 rounded-card border border-gray-200 bg-white p-4 text-left hover:border-primary/40"><span className="rounded-full bg-primary-soft px-2 py-1 text-nano font-semibold text-primary">{t('community.stepProgress', { step: draft.step })} · {draft.visibility}</span><h2 className="mt-3 font-semibold text-ink">{draft.title || t('app.untitledPublication')}</h2><p className="mt-1 text-xs text-mute">{draft.package.designVersionId}</p></button>)}
        </CardGrid>
      ) : <CardGrid empty={tab==='hidden'?t('app.noHiddenLooks'):t('app.noPublishedLooks')}>
        {visibleLooks.map((look)=><article key={look.lookId} className="rounded-card border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-gray-100 px-2 py-1 text-nano font-semibold text-gray-600">{look.visibility}</span><h2 className="mt-3 font-semibold text-ink">{look.title}</h2><p className="mt-1 text-xs text-mute">{look.designVersionId}</p></div><div className="flex flex-wrap gap-2">{look.status==='PUBLISHED'&&<Button variant="secondary" disabled={actionBusy} onClick={()=>void shareLook(look.designVersionId)}><Send size={14}/>{t('share.share')}</Button>}{look.status==='HIDDEN'?<Button variant="secondary" disabled={actionBusy} onClick={()=>void toggleHidden(look.lookId,false)}><Eye size={14}/>{t('share.restore')}</Button>:<Button variant="secondary" disabled={actionBusy} onClick={()=>void toggleHidden(look.lookId,true)}><EyeOff size={14}/>{t('share.hide')}</Button>}</div></div></article>)}
      </CardGrid>}
    </div>
  );
}

function CardGrid({children,empty}:{children:ReactNode;empty:string}) { return <div className="grid gap-3 md:grid-cols-2">{Children.count(children) > 0 ? children : <div className="col-span-full rounded-card border border-dashed border-gray-300 bg-surface-soft p-10 text-center text-sm text-mute"><Archive className="mx-auto mb-3"/>{empty}</div>}</div>; }

type DiscoveryIssueCode = 'missing_style' | 'missing_shape' | 'rights_pending';

/** Pure structured-discovery readiness check against the strict taxonomy. */
function discoveryIssuesV2(authoring: CreatorDiscoveryAuthoringV2, taxonomy: CommunityTaxonomyV2): DiscoveryIssueCode[] {
  const issues: DiscoveryIssueCode[] = [];
  if (authoring.styleIds.length === 0 || authoring.styleIds.some((id) => !resolveTagId(taxonomy, id))) issues.push('missing_style');
  if (authoring.recommendedShapeIds.length === 0 || authoring.recommendedShapeIds.some((id) => !resolveTagId(taxonomy, id))) issues.push('missing_shape');
  if (authoring.rights === 'PENDING') issues.push('rights_pending');
  return issues;
}

function PublishWizard({draft,busy,governanceStatus,taxonomy,taxonomyError,onSubmitReview,onUpdate,onPublish,onClose,t}:{draft:CreatorPublicationDraftV2;busy:boolean;governanceStatus?:'PENDING'|'CLEARED'|'REJECTED';taxonomy:CommunityTaxonomyV2|null;taxonomyError:string|null;onSubmitReview:()=>void;onUpdate:(patch:CreatorPublicationDraftPatchV1)=>void;onPublish:()=>void;onClose:()=>void;t:(key:MessageKey,params?:MessageParams)=>string}) {
  const sources = ['ORIGINAL','REMIX','IMPORTED','AI_ASSISTED'] as const;
  const discoveryReady = taxonomy !== null && discoveryIssuesV2(draft.discovery, taxonomy).length === 0;
  return <section className="rounded-card border border-primary/20 bg-white p-5" data-testid="creator-publish-wizard" aria-busy={busy}><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold text-primary">{t('wizard.threeStepPublish')}</p><h2 className="text-h2 font-bold text-ink">{draft.title || t('app.untitledPublication')}</h2></div><Button variant="ghost" disabled={busy} onClick={onClose}>{t('wizard.back')}</Button></div><ol className="mb-6 grid grid-cols-3 gap-2">{[t('wizard.metadata'),t('app.visibility'),t('wizard.source')].map((label,index)=><li key={label} className={`rounded-button px-3 py-2 text-center text-xs font-semibold ${draft.step===index+1?'bg-primary text-white':draft.step>index+1?'bg-success-soft text-success':'bg-gray-100 text-mute'}`}>{index+1}. {label}</li>)}</ol>
    {draft.step===1&&<div className="space-y-4"><Input label={t('editor.title')} value={draft.title} maxLength={80} onChange={(event)=>onUpdate({title:event.target.value})}/><Input label={t('editor.tagsCommaSeparatedMax12')} helper={t('editor.freeFormTagsSearchCopyOnlyNotAuthoritativeDiscoveryTagsCompleteStructuredDiscoveryFieldsBelow')} value={draft.tags.join(', ')} onChange={(event)=>onUpdate({tags:event.target.value.split(',').map(v=>v.trim()).filter(Boolean).slice(0,12)})}/><StructuredDiscoveryEditor authoring={draft.discovery} taxonomy={taxonomy} taxonomyError={taxonomyError} disabled={busy} onChange={(discovery)=>onUpdate({discovery})} t={t}/><PackageSummary draft={draft}/><DiscoveryValidationSummary authoring={draft.discovery} taxonomy={taxonomy} taxonomyError={taxonomyError} t={t}/><Button disabled={!draft.title.trim()||!discoveryReady} onClick={()=>onUpdate({step:2})}>{t('editor.nextVisibility')}</Button></div>}
    {draft.step===2&&<div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{(['PRIVATE','UNLISTED','PUBLIC'] as const).map((visibility)=><button key={visibility} disabled={visibility==='PUBLIC'&&governanceStatus!=='CLEARED'} onClick={()=>onUpdate({visibility})} className={`min-h-24 rounded-card border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${draft.visibility===visibility?'border-primary bg-primary-soft':'border-gray-200'}`}><LockKeyhole size={17} className="text-primary"/><strong className="mt-2 block text-sm">{visibility}</strong><span className="text-xs text-mute">{visibility==='PRIVATE'?t('app.onlyCanManage'):visibility==='UNLISTED'?t('app.linkAccessNotIndexed'):t('app.indexedAfterSourceDeclarationClearance')}</span></button>)}</div><div className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><strong>{t('community.publicReviewStatus', { status: governanceStatus??'NOT_SUBMITTED' })}</strong><p className="mt-1">{t('app.publicReviewBoundExactContentRevisionCompleteSourceCopyrightDeclarationsNext')}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={()=>onUpdate({step:1})}>{t('app.back')}</Button><Button onClick={()=>onUpdate({step:3})}>{t('app.nextSource')}</Button></div></div>}
    {draft.step===3&&<div className="space-y-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{sources.map((source)=><button key={source} disabled={busy} onClick={()=>onUpdate({sourceType:source})} className={`min-h-11 rounded-button border px-2 text-xs font-semibold disabled:opacity-50 ${draft.sourceType===source?'border-primary bg-primary-soft text-primary':'border-gray-200 text-body'}`}>{source}</button>)}</div>{draft.sourceType!=='ORIGINAL'&&<Input disabled={busy} label={t('app.sourceAttribution')} value={draft.sourceAttribution??''} onChange={(event)=>onUpdate({sourceAttribution:event.target.value})}/>}<label className="flex min-h-11 items-center gap-3 rounded-button border border-gray-200 px-3 text-sm"><input type="checkbox" disabled={busy} className="accent-primary" checked={draft.copyrightDeclared} onChange={(e)=>onUpdate({copyrightDeclared:e.target.checked})}/>{t('app.iHaveRightPublishReferenceContent')}</label><label className="flex min-h-11 items-center gap-3 rounded-button border border-gray-200 px-3 text-sm"><input type="checkbox" disabled={busy} className="accent-primary" checked={draft.sourceDeclared} onChange={(e)=>onUpdate({sourceDeclared:e.target.checked})}/>{t('app.sourceTypeAttributionAccurate')}</label><div className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><strong>{t('community.publicReviewRevisionStatus', { status: governanceStatus??'NOT_SUBMITTED', revision: draft.contentRevision })}</strong><div className="mt-2"><Button variant="secondary" loading={busy} disabled={busy||!draft.copyrightDeclared||!draft.sourceDeclared||governanceStatus==='PENDING'||governanceStatus==='CLEARED'} onClick={onSubmitReview}>{governanceStatus==='REJECTED'?t('app.resubmitRevision'):t('app.submitRevision')}</Button></div></div><div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={()=>onUpdate({step:2})}>{t('app.back')}</Button><Button loading={busy} disabled={busy||!draft.copyrightDeclared||!draft.sourceDeclared||(draft.visibility==='PUBLIC'&&governanceStatus!=='CLEARED')} onClick={onPublish}><Send size={15}/>{t('app.publishLibrary')}</Button></div></div>}
  </section>;
}

function PackageSummary({draft}:{draft:CreatorPublicationDraftV2}) { const { t } = useLocale(); return <div className="grid gap-2 rounded-card bg-surface-soft p-4 sm:grid-cols-3"><div><span className="text-nano text-mute">{t('community.designVersion')}</span><strong className="block text-xs text-body">{draft.package.designVersionId}</strong></div><div><span className="text-nano text-mute">{t('community.fidelity')}</span><strong className="block text-xs text-body">{draft.package.fidelity}</strong></div><div><span className="text-nano text-mute">{t('community.derivedAssets')}</span><strong className="block text-xs text-body"><Sparkles size={13} className="mr-1 inline"/>{1+draft.package.details.length}</strong></div></div>; }

/**
 * COMM-v0.7.2-TAX-02 structured discovery authoring (step 1 of the wizard).
 * Every option label comes from the strict taxonomy-v2 fixture (shared
 * zh-CN/en identity); no second vocabulary is hardcoded here. On taxonomy
 * load failure the whole fieldset is disabled and the error is visible —
 * fail closed, no fallback taxonomy, no direct cast.
 */
function StructuredDiscoveryEditor({authoring,taxonomy,taxonomyError,disabled,onChange,t}:{authoring:CreatorDiscoveryAuthoringV2;taxonomy:CommunityTaxonomyV2|null;taxonomyError:string|null;disabled:boolean;onChange:(next:CreatorDiscoveryAuthoringV2)=>void;t:(key:MessageKey,params?:MessageParams)=>string}) {
  const { locale } = useLocale();
  const unavailable = taxonomy === null;
  const toggle = (key:'styleIds'|'recommendedShapeIds'|'sceneIds'|'themeIds'|'techniqueIds'|'lengthIds', id:string) => {
    const list = authoring[key];
    onChange({ ...authoring, [key]: list.includes(id) ? list.filter((item)=>item!==id) : [...list, id] });
  };
  const dimensionTags = (dimension:'STYLE'|'SHAPE'|'SCENE'|'THEME'|'TECHNIQUE'|'LENGTH') => (taxonomy ? taxonomy.dimensions[dimension].tags : []);
  const rightsOptions = taxonomy ? RIGHTS_STATUSES.map((status):{value:RightsStatus;tagId:string;label:string}=>{
    const tag = resolveTagId(taxonomy, RIGHTS_STATUS_TAGS[status]);
    return { value: status, tagId: RIGHTS_STATUS_TAGS[status], label: tag ? localizedLabel(tag.labels['zh-CN'], tag.labels.en, locale) : status };
  }) : [];
  const makeabilityOptions = taxonomy ? MAKEABILITY_CLASSIFICATIONS.map((classification):{value:MakeabilityClassification;tagId:string;label:string}=>{
    const tag = resolveTagId(taxonomy, MAKEABILITY_CLASSIFICATION_TAGS[classification]);
    return { value: classification, tagId: MAKEABILITY_CLASSIFICATION_TAGS[classification], label: tag ? localizedLabel(tag.labels['zh-CN'], tag.labels.en, locale) : classification };
  }) : [];
  return <fieldset disabled={unavailable||disabled} data-testid="structured-discovery-editor" className="space-y-4 rounded-card border border-gray-200 bg-surface-soft p-4">
    <legend className="px-1 text-xs font-semibold text-primary">{t('app.structuredDiscoveryMetadataTaxonomyV2')}</legend>
    {taxonomyError && <p role="alert" className="rounded-card border border-error/30 bg-error/5 p-3 text-sm text-error">{t('app.taxonomyV2FailedLoadStructuredAuthoringDisabledNoFallbackVocabulary')}<span className="block break-all font-mono text-xs">{taxonomyError}</span></p>}
    {unavailable && !taxonomyError && <p role="status" className="rounded-card border border-gray-200 bg-white p-3 text-sm text-mute">{t('app.loadingTaxonomyV2')}</p>}
    <DiscoverySection label={t('app.overallStyleRequiredMultiSelect')} required>
      <TagPicker tags={dimensionTags('STYLE')} selected={authoring.styleIds} onToggle={(id)=>toggle('styleIds',id)} testIdPrefix="taxonomy-option"/>
    </DiscoverySection>
    <DiscoverySection label={t('app.recommendedShapesRequiredMultiSelect')} required>
      <TagPicker tags={dimensionTags('SHAPE')} selected={authoring.recommendedShapeIds} onToggle={(id)=>toggle('recommendedShapeIds',id)} testIdPrefix="taxonomy-option"/>
    </DiscoverySection>
    <DiscoverySection label={t('app.scenesOptionalMultiSelect')}>
      <TagPicker tags={dimensionTags('SCENE')} selected={authoring.sceneIds} onToggle={(id)=>toggle('sceneIds',id)} testIdPrefix="taxonomy-option"/>
    </DiscoverySection>
    <DiscoverySection label={t('app.themesOptionalMultiSelect')}>
      <TagPicker tags={dimensionTags('THEME')} selected={authoring.themeIds} onToggle={(id)=>toggle('themeIds',id)} testIdPrefix="taxonomy-option"/>
    </DiscoverySection>
    <DiscoverySection label={t('app.techniquesOptionalMultiSelect')}>
      <TagPicker tags={dimensionTags('TECHNIQUE')} selected={authoring.techniqueIds} onToggle={(id)=>toggle('techniqueIds',id)} testIdPrefix="taxonomy-option"/>
    </DiscoverySection>
    <DiscoverySection label={t('app.lengthOptionalMultiSelect')}>
      <TagPicker tags={dimensionTags('LENGTH')} selected={authoring.lengthIds} onToggle={(id)=>toggle('lengthIds',id)} testIdPrefix="taxonomy-option"/>
    </DiscoverySection>
    <DiscoverySection label={t('app.rightsSingleSelect')} required>
      <SingleSelectPicker options={rightsOptions} value={authoring.rights} onSelect={(value)=>onChange({...authoring,rights:value})} testIdPrefix="taxonomy-option"/>
      {authoring.rights==='PENDING'&&<p className="text-xs text-mute">{t('auth.pendingByDefaultPickExplicitRightsStatusBeforePublishingPendingNeverPublic')}</p>}
    </DiscoverySection>
    <DiscoverySection label={t('app.makeabilityClassificationSingleSelect')} required>
      <SingleSelectPicker options={makeabilityOptions} value={authoring.makeability} onSelect={(value)=>onChange({...authoring,makeability:value})} testIdPrefix="taxonomy-option"/>
      <p className="text-xs text-mute">{t('app.classificationRecordsIntentOnlyPrototypeCarriesNoCapabilityAssetEvidenceChainDoesNotClaimPhysicalManufacturability')}</p>
    </DiscoverySection>
  </fieldset>;
}

function DiscoverySection({label,required,children}:{label:string;required?:boolean;children:ReactNode}) {
  return <div><p className="mb-1.5 text-xs font-semibold text-gray-700">{label}{required&&<span className="ml-1 text-error">*</span>}</p>{children}</div>;
}

function TagPicker({tags,selected,onToggle,testIdPrefix}:{tags:readonly {id:string;labels:BilingualLabelsV2}[];selected:readonly string[];onToggle:(id:string)=>void;testIdPrefix:string}) {
  const { locale } = useLocale();
  if (tags.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{tags.map((tag)=>{const active=selected.includes(tag.id);return <button key={tag.id} type="button" aria-pressed={active} data-testid={`${testIdPrefix}-${tag.id}`} onClick={()=>onToggle(tag.id)} className={`min-h-11 rounded-button border px-2.5 py-1.5 text-xs transition-colors ${active?'border-primary bg-primary-soft font-semibold text-primary':'border-gray-200 text-body hover:border-primary/40'}`}>{localizedLabel(tag.labels['zh-CN'],tag.labels.en,locale)}</button>;})}</div>;
}

function SingleSelectPicker<T extends string>({options,value,onSelect,testIdPrefix}:{options:readonly {value:T;tagId:string;label:string}[];value:T;onSelect:(value:T)=>void;testIdPrefix:string}) {
  if (options.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{options.map((option)=>{const active=option.value===value;return <button key={option.value} type="button" aria-pressed={active} data-testid={`${testIdPrefix}-${option.tagId}`} onClick={()=>onSelect(option.value)} className={`min-h-11 rounded-button border px-2.5 py-1.5 text-xs transition-colors ${active?'border-primary bg-primary-soft font-semibold text-primary':'border-gray-200 text-body hover:border-primary/40'}`}>{option.label}</button>;})}</div>;
}

function DiscoveryValidationSummary({authoring,taxonomy,taxonomyError,t}:{authoring:CreatorDiscoveryAuthoringV2;taxonomy:CommunityTaxonomyV2|null;taxonomyError:string|null;t:(key:MessageKey,params?:MessageParams)=>string}) {
  if (!taxonomy) {
    return <p role="status" data-testid="discovery-validation-summary" className="rounded-card border border-error/30 bg-error/5 p-3 text-sm text-error">{t('app.discoveryUnavailableTaxonomyV2DidNotLoadPublishFlowCannotContinue')}{taxonomyError&&<span className="block break-all font-mono text-xs">{taxonomyError}</span>}</p>;
  }
  const issues = discoveryIssuesV2(authoring, taxonomy);
  if (issues.length > 0) {
    const missing = issues.map((code)=>code==='missing_style'?t('wizard.overallStyle'):code==='missing_shape'?t('wizard.recommendedShape'):t('wizard.rightsStatusPending'));
    return <p role="status" data-testid="discovery-validation-summary" className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{t('app.discoveryIncomplete')}{missing.join(' · ')}</p>;
  }
  return <p role="status" data-testid="discovery-validation-summary" className="rounded-card border border-success/30 bg-success/10 p-3 text-sm text-success">{t('wizard.discoveryReady')}{authoring.styleIds.length} {t('wizard.styles')} · {authoring.recommendedShapeIds.length} {t('wizard.shapes')} · {authoring.rights} · {authoring.makeability}</p>;
}
