import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, Eye, EyeOff, FilePlus2, LockKeyhole, Send, Sparkles } from 'lucide-react';
import { Button, Input, Tabs, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
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
  const { text } = useLocale();
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
      if (!authority.ok) { toast.error(`${text('发布资产未就绪', 'Publish assets are not ready')}: ${authority.error.reason}`); return; }
      const created = await creatorWorkspaceServiceV1.createDraft(CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.designVersionId);
      if (!created.ok) { toast.error(`${text('无法创建发布草稿', 'Could not create publication draft')}: ${created.error.reason}`); return; }
      applyState(created.value); setActiveId(created.value.draftId); setTab('drafts');
      toast.success(text('已创建 PRIVATE 发布草稿', 'PRIVATE publication draft created'));
    } catch { toast.error(text('无法生成发布包', 'Could not create a publish package')); }
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
      if (!result.ok) { toast.warning(`${text('请完成标题、来源和版权声明', 'Complete title, source and copyright declarations')}: ${result.error.reason}`); return; }
      applyState(result.value); setActiveId(null); setTab('published'); toast.success(text('已发布到创作者作品库', 'Published to creator library'));
    } finally { actionLock.current = false; setActionBusy(false); }
  };
  const submitReview=async()=>{if(!active||actionLock.current)return;actionLock.current=true;setActionBusy(true);try{await updateQueue.current;const result=await creatorWorkspaceServiceV1.submitReview(active.draftId);if(!result.ok){toast.error(`${text('提交审核失败','Review submission failed')}: ${result.error.reason}`);return}applyState(result.value);toast.success(text('PUBLIC 审核已提交','PUBLIC review submitted'));}finally{actionLock.current=false;setActionBusy(false);}};

  const toggleHidden = async (lookId: string, hidden: boolean) => {
    if(actionLock.current)return;actionLock.current=true;setActionBusy(true);try{const result = await creatorWorkspaceServiceV1.setLookHidden(lookId, hidden);
    if (!result.ok) { toast.error(result.error.reason); return; }
    applyState(result.value); toast.success(hidden ? text('作品已隐藏', 'Look hidden') : text('作品已恢复', 'Look restored'));}finally{actionLock.current=false;setActionBusy(false);}
  };
  const shareLook = async (designVersionId:string) => {
    if(actionLock.current)return;actionLock.current=true;setActionBusy(true);try{const created=await creatorWorkspaceServiceV1.createClientShare(designVersionId);
    if(!created.ok){toast.error(`${text('创建分享失败','Could not create share')}: ${created.error.reason}`);return;}
    const url=new URL(Routes.communityClientShare(created.value.rawToken),window.location.origin).toString();await navigator.clipboard?.writeText(url);toast.success(text('顾客确认链接已复制（7 天有效）','Client approval link copied (7 days)'));}finally{actionLock.current=false;setActionBusy(false);}
  };

  const visibleLooks = store.looks.filter((look) => tab === 'hidden' ? look.status === 'HIDDEN' : look.status === 'PUBLISHED');
  return (
    <div className="space-y-5" data-testid="creator-workspace-page">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-primary/15 bg-gradient-to-br from-white to-primary-soft p-5">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Creator Workspace · Local prototype</p><h1 className="mt-1 text-h1 font-bold text-ink">{text('发布与作品管理', 'Publish and manage looks')}</h1><p className="mt-2 max-w-2xl text-sm text-body">{text('从固定 DesignVersion 的 Publish Package 创建作品。当前只开放 PRIVATE / UNLISTED；PUBLIC 需等待治理门禁。', 'Create looks from a fixed DesignVersion Publish Package. PRIVATE / UNLISTED only; PUBLIC requires governance.')}</p></div>
        <Button onClick={startDraft} loading={busy} disabled={busy||actionBusy} className="min-h-11"><FilePlus2 size={16} />{text('新建发布', 'New publication')}</Button>
      </header>
      {loadError && <p role="alert" className="rounded-card border border-error/30 bg-error/5 p-3 text-sm text-error">{text('发布服务不可用，未覆盖原记录。', 'Publication service unavailable; existing data was not overwritten.')} <span className="font-mono">{loadError}</span></p>}
      <Tabs activeKey={tab} onChange={setTab} items={[{key:'drafts',label:`${text('草稿','Drafts')} ${store.drafts.length}`},{key:'published',label:`${text('已发布','Published')} ${store.looks.filter((l)=>l.status==='PUBLISHED').length}`},{key:'hidden',label:`${text('已隐藏','Hidden')} ${store.looks.filter((l)=>l.status==='HIDDEN').length}`}]} />
      {active ? <PublishWizard draft={active} busy={actionBusy} governanceStatus={governance.publicationReviews.slice().reverse().find(review=>review.draftId===active.draftId&&review.draftRevision===active.contentRevision)?.status} taxonomy={taxonomy} taxonomyError={taxonomyError} onSubmitReview={submitReview} onUpdate={update} onPublish={publish} onClose={() => setActiveId(null)} text={text} /> : tab === 'drafts' ? (
        <CardGrid empty={text('还没有发布草稿。新建发布会从固定版本生成可解释的 2D Publish Package。','No publication drafts yet.')}>
          {store.drafts.map((draft) => <button key={draft.draftId} onClick={()=>setActiveId(draft.draftId)} className="min-h-32 rounded-card border border-gray-200 bg-white p-4 text-left hover:border-primary/40"><span className="rounded-full bg-primary-soft px-2 py-1 text-nano font-semibold text-primary">Step {draft.step}/3 · {draft.visibility}</span><h2 className="mt-3 font-semibold text-ink">{draft.title || text('未命名发布草稿','Untitled publication')}</h2><p className="mt-1 text-xs text-mute">{draft.package.designVersionId}</p></button>)}
        </CardGrid>
      ) : <CardGrid empty={tab==='hidden'?text('没有已隐藏作品','No hidden looks'):text('还没有已发布作品','No published looks')}>
        {visibleLooks.map((look)=><article key={look.lookId} className="rounded-card border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-gray-100 px-2 py-1 text-nano font-semibold text-gray-600">{look.visibility}</span><h2 className="mt-3 font-semibold text-ink">{look.title}</h2><p className="mt-1 text-xs text-mute">{look.designVersionId}</p></div><div className="flex flex-wrap gap-2">{look.status==='PUBLISHED'&&<Button variant="secondary" disabled={actionBusy} onClick={()=>void shareLook(look.designVersionId)}><Send size={14}/>{text('分享确认','Share')}</Button>}{look.status==='HIDDEN'?<Button variant="secondary" disabled={actionBusy} onClick={()=>void toggleHidden(look.lookId,false)}><Eye size={14}/>{text('恢复','Restore')}</Button>:<Button variant="secondary" disabled={actionBusy} onClick={()=>void toggleHidden(look.lookId,true)}><EyeOff size={14}/>{text('隐藏','Hide')}</Button>}</div></div></article>)}
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

function PublishWizard({draft,busy,governanceStatus,taxonomy,taxonomyError,onSubmitReview,onUpdate,onPublish,onClose,text}:{draft:CreatorPublicationDraftV2;busy:boolean;governanceStatus?:'PENDING'|'CLEARED'|'REJECTED';taxonomy:CommunityTaxonomyV2|null;taxonomyError:string|null;onSubmitReview:()=>void;onUpdate:(patch:CreatorPublicationDraftPatchV1)=>void;onPublish:()=>void;onClose:()=>void;text:(zh:string,en:string)=>string}) {
  const sources = ['ORIGINAL','REMIX','IMPORTED','AI_ASSISTED'] as const;
  const discoveryReady = taxonomy !== null && discoveryIssuesV2(draft.discovery, taxonomy).length === 0;
  return <section className="rounded-card border border-primary/20 bg-white p-5" data-testid="creator-publish-wizard" aria-busy={busy}><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold text-primary">{text('三步发布','Three-step publish')}</p><h2 className="text-h2 font-bold text-ink">{draft.title || text('未命名发布草稿','Untitled publication')}</h2></div><Button variant="ghost" disabled={busy} onClick={onClose}>{text('返回列表','Back')}</Button></div><ol className="mb-6 grid grid-cols-3 gap-2">{[text('元数据','Metadata'),text('可见性','Visibility'),text('来源确认','Source')].map((label,index)=><li key={label} className={`rounded-button px-3 py-2 text-center text-xs font-semibold ${draft.step===index+1?'bg-primary text-white':draft.step>index+1?'bg-success-soft text-success':'bg-gray-100 text-mute'}`}>{index+1}. {label}</li>)}</ol>
    {draft.step===1&&<div className="space-y-4"><Input label={text('作品标题','Title')} value={draft.title} maxLength={80} onChange={(event)=>onUpdate({title:event.target.value})}/><Input label={text('标签（逗号分隔，最多 12 个）','Tags (comma-separated, max 12)')} helper={text('自由标签仅用于搜索文案，不是权威发现标签；请在下方结构化字段中完成发现元数据。','Free-form tags are search copy only, not authoritative discovery tags; complete the structured discovery fields below.')} value={draft.tags.join(', ')} onChange={(event)=>onUpdate({tags:event.target.value.split(',').map(v=>v.trim()).filter(Boolean).slice(0,12)})}/><StructuredDiscoveryEditor authoring={draft.discovery} taxonomy={taxonomy} taxonomyError={taxonomyError} disabled={busy} onChange={(discovery)=>onUpdate({discovery})} text={text}/><PackageSummary draft={draft}/><DiscoveryValidationSummary authoring={draft.discovery} taxonomy={taxonomy} taxonomyError={taxonomyError} text={text}/><Button disabled={!draft.title.trim()||!discoveryReady} onClick={()=>onUpdate({step:2})}>{text('下一步：可见性','Next: visibility')}</Button></div>}
    {draft.step===2&&<div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{(['PRIVATE','UNLISTED','PUBLIC'] as const).map((visibility)=><button key={visibility} disabled={visibility==='PUBLIC'&&governanceStatus!=='CLEARED'} onClick={()=>onUpdate({visibility})} className={`min-h-24 rounded-card border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${draft.visibility===visibility?'border-primary bg-primary-soft':'border-gray-200'}`}><LockKeyhole size={17} className="text-primary"/><strong className="mt-2 block text-sm">{visibility}</strong><span className="text-xs text-mute">{visibility==='PRIVATE'?text('仅自己管理','Only you can manage'):visibility==='UNLISTED'?text('持链接可查看；不进入 Explore','Link access; not indexed'):text('完成来源声明并通过审核后进入 Explore','Indexed after source declaration and clearance')}</span></button>)}</div><div className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><strong>PUBLIC review · {governanceStatus??'NOT_SUBMITTED'}</strong><p className="mt-1">{text('PUBLIC 审核绑定当前内容修订；请先在下一步完成来源与版权声明。','PUBLIC review is bound to the exact content revision. Complete source and copyright declarations next.')}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={()=>onUpdate({step:1})}>{text('上一步','Back')}</Button><Button onClick={()=>onUpdate({step:3})}>{text('下一步：来源','Next: source')}</Button></div></div>}
    {draft.step===3&&<div className="space-y-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{sources.map((source)=><button key={source} disabled={busy} onClick={()=>onUpdate({sourceType:source})} className={`min-h-11 rounded-button border px-2 text-xs font-semibold disabled:opacity-50 ${draft.sourceType===source?'border-primary bg-primary-soft text-primary':'border-gray-200 text-body'}`}>{source}</button>)}</div>{draft.sourceType!=='ORIGINAL'&&<Input disabled={busy} label={text('来源说明 / Attribution','Source attribution')} value={draft.sourceAttribution??''} onChange={(event)=>onUpdate({sourceAttribution:event.target.value})}/>}<label className="flex min-h-11 items-center gap-3 rounded-button border border-gray-200 px-3 text-sm"><input type="checkbox" disabled={busy} className="accent-primary" checked={draft.copyrightDeclared} onChange={(e)=>onUpdate({copyrightDeclared:e.target.checked})}/>{text('我确认拥有发布或引用该内容的权利','I have the right to publish or reference this content')}</label><label className="flex min-h-11 items-center gap-3 rounded-button border border-gray-200 px-3 text-sm"><input type="checkbox" disabled={busy} className="accent-primary" checked={draft.sourceDeclared} onChange={(e)=>onUpdate({sourceDeclared:e.target.checked})}/>{text('来源类型与说明真实完整','Source type and attribution are accurate')}</label><div className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><strong>PUBLIC review · {governanceStatus??'NOT_SUBMITTED'} · r{draft.contentRevision}</strong><div className="mt-2"><Button variant="secondary" loading={busy} disabled={busy||!draft.copyrightDeclared||!draft.sourceDeclared||governanceStatus==='PENDING'||governanceStatus==='CLEARED'} onClick={onSubmitReview}>{governanceStatus==='REJECTED'?text('重新提交当前修订','Resubmit this revision'):text('提交当前修订审核','Submit this revision')}</Button></div></div><div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={()=>onUpdate({step:2})}>{text('上一步','Back')}</Button><Button loading={busy} disabled={busy||!draft.copyrightDeclared||!draft.sourceDeclared||(draft.visibility==='PUBLIC'&&governanceStatus!=='CLEARED')} onClick={onPublish}><Send size={15}/>{text('发布到作品库','Publish to library')}</Button></div></div>}
  </section>;
}

function PackageSummary({draft}:{draft:CreatorPublicationDraftV2}) { return <div className="grid gap-2 rounded-card bg-surface-soft p-4 sm:grid-cols-3"><div><span className="text-nano text-mute">DesignVersion</span><strong className="block text-xs text-body">{draft.package.designVersionId}</strong></div><div><span className="text-nano text-mute">Fidelity</span><strong className="block text-xs text-body">{draft.package.fidelity}</strong></div><div><span className="text-nano text-mute">Derived assets</span><strong className="block text-xs text-body"><Sparkles size={13} className="mr-1 inline"/>{1+draft.package.details.length}</strong></div></div>; }

/**
 * COMM-v0.7.2-TAX-02 structured discovery authoring (step 1 of the wizard).
 * Every option label comes from the strict taxonomy-v2 fixture (shared
 * zh-CN/en identity); no second vocabulary is hardcoded here. On taxonomy
 * load failure the whole fieldset is disabled and the error is visible —
 * fail closed, no fallback taxonomy, no direct cast.
 */
function StructuredDiscoveryEditor({authoring,taxonomy,taxonomyError,disabled,onChange,text}:{authoring:CreatorDiscoveryAuthoringV2;taxonomy:CommunityTaxonomyV2|null;taxonomyError:string|null;disabled:boolean;onChange:(next:CreatorDiscoveryAuthoringV2)=>void;text:(zh:string,en:string)=>string}) {
  const unavailable = taxonomy === null;
  const toggle = (key:'styleIds'|'recommendedShapeIds'|'sceneIds'|'themeIds'|'techniqueIds'|'lengthIds', id:string) => {
    const list = authoring[key];
    onChange({ ...authoring, [key]: list.includes(id) ? list.filter((item)=>item!==id) : [...list, id] });
  };
  const dimensionTags = (dimension:'STYLE'|'SHAPE'|'SCENE'|'THEME'|'TECHNIQUE'|'LENGTH') => (taxonomy ? taxonomy.dimensions[dimension].tags : []);
  const rightsOptions = taxonomy ? RIGHTS_STATUSES.map((status):{value:RightsStatus;tagId:string;label:string}=>{
    const tag = resolveTagId(taxonomy, RIGHTS_STATUS_TAGS[status]);
    return { value: status, tagId: RIGHTS_STATUS_TAGS[status], label: tag ? text(tag.labels['zh-CN'], tag.labels.en) : status };
  }) : [];
  const makeabilityOptions = taxonomy ? MAKEABILITY_CLASSIFICATIONS.map((classification):{value:MakeabilityClassification;tagId:string;label:string}=>{
    const tag = resolveTagId(taxonomy, MAKEABILITY_CLASSIFICATION_TAGS[classification]);
    return { value: classification, tagId: MAKEABILITY_CLASSIFICATION_TAGS[classification], label: tag ? text(tag.labels['zh-CN'], tag.labels.en) : classification };
  }) : [];
  return <fieldset disabled={unavailable||disabled} data-testid="structured-discovery-editor" className="space-y-4 rounded-card border border-gray-200 bg-surface-soft p-4">
    <legend className="px-1 text-xs font-semibold text-primary">{text('结构化发现元数据（taxonomy-v2）','Structured discovery metadata (taxonomy-v2)')}</legend>
    {taxonomyError && <p role="alert" className="rounded-card border border-error/30 bg-error/5 p-3 text-sm text-error">{text('taxonomy-v2 加载失败，结构化创作已禁用（无回退词表）。','taxonomy-v2 failed to load; structured authoring is disabled (no fallback vocabulary).')}<span className="block break-all font-mono text-xs">{taxonomyError}</span></p>}
    {unavailable && !taxonomyError && <p role="status" className="rounded-card border border-gray-200 bg-white p-3 text-sm text-mute">{text('正在加载 taxonomy-v2…','Loading taxonomy-v2…')}</p>}
    <DiscoverySection label={text('整体风格（必选，可多选）','Overall style (required, multi-select)')} required>
      <TagPicker tags={dimensionTags('STYLE')} selected={authoring.styleIds} onToggle={(id)=>toggle('styleIds',id)} testIdPrefix="taxonomy-option" text={text}/>
    </DiscoverySection>
    <DiscoverySection label={text('推荐甲型（必选，可多选）','Recommended shapes (required, multi-select)')} required>
      <TagPicker tags={dimensionTags('SHAPE')} selected={authoring.recommendedShapeIds} onToggle={(id)=>toggle('recommendedShapeIds',id)} testIdPrefix="taxonomy-option" text={text}/>
    </DiscoverySection>
    <DiscoverySection label={text('场景（可选，可多选）','Scenes (optional, multi-select)')}>
      <TagPicker tags={dimensionTags('SCENE')} selected={authoring.sceneIds} onToggle={(id)=>toggle('sceneIds',id)} testIdPrefix="taxonomy-option" text={text}/>
    </DiscoverySection>
    <DiscoverySection label={text('主题（可选，可多选）','Themes (optional, multi-select)')}>
      <TagPicker tags={dimensionTags('THEME')} selected={authoring.themeIds} onToggle={(id)=>toggle('themeIds',id)} testIdPrefix="taxonomy-option" text={text}/>
    </DiscoverySection>
    <DiscoverySection label={text('技法（可选，可多选）','Techniques (optional, multi-select)')}>
      <TagPicker tags={dimensionTags('TECHNIQUE')} selected={authoring.techniqueIds} onToggle={(id)=>toggle('techniqueIds',id)} testIdPrefix="taxonomy-option" text={text}/>
    </DiscoverySection>
    <DiscoverySection label={text('长度（可选，可多选）','Length (optional, multi-select)')}>
      <TagPicker tags={dimensionTags('LENGTH')} selected={authoring.lengthIds} onToggle={(id)=>toggle('lengthIds',id)} testIdPrefix="taxonomy-option" text={text}/>
    </DiscoverySection>
    <DiscoverySection label={text('权利（单选）','Rights (single select)')} required>
      <SingleSelectPicker options={rightsOptions} value={authoring.rights} onSelect={(value)=>onChange({...authoring,rights:value})} testIdPrefix="taxonomy-option"/>
      {authoring.rights==='PENDING'&&<p className="text-xs text-mute">{text('默认 PENDING：发布前必须显式选择权利状态；PENDING 永不公开。','PENDING by default: pick an explicit rights status before publishing; PENDING is never public.')}</p>}
    </DiscoverySection>
    <DiscoverySection label={text('可制作性分类（单选）','Makeability classification (single select)')} required>
      <SingleSelectPicker options={makeabilityOptions} value={authoring.makeability} onSelect={(value)=>onChange({...authoring,makeability:value})} testIdPrefix="taxonomy-option"/>
      <p className="text-xs text-mute">{text('分类仅记录意图；当前原型不含 capability/资产/证据链，不代表物理可制作。','Classification records intent only; this prototype carries no capability/asset/evidence chain and does not claim physical manufacturability.')}</p>
    </DiscoverySection>
  </fieldset>;
}

function DiscoverySection({label,required,children}:{label:string;required?:boolean;children:ReactNode}) {
  return <div><p className="mb-1.5 text-xs font-semibold text-gray-700">{label}{required&&<span className="ml-1 text-error">*</span>}</p>{children}</div>;
}

function TagPicker({tags,selected,onToggle,testIdPrefix,text}:{tags:readonly {id:string;labels:BilingualLabelsV2}[];selected:readonly string[];onToggle:(id:string)=>void;testIdPrefix:string;text:(zh:string,en:string)=>string}) {
  if (tags.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{tags.map((tag)=>{const active=selected.includes(tag.id);return <button key={tag.id} type="button" aria-pressed={active} data-testid={`${testIdPrefix}-${tag.id}`} onClick={()=>onToggle(tag.id)} className={`min-h-11 rounded-button border px-2.5 py-1.5 text-xs transition-colors ${active?'border-primary bg-primary-soft font-semibold text-primary':'border-gray-200 text-body hover:border-primary/40'}`}>{text(tag.labels['zh-CN'],tag.labels.en)}</button>;})}</div>;
}

function SingleSelectPicker<T extends string>({options,value,onSelect,testIdPrefix}:{options:readonly {value:T;tagId:string;label:string}[];value:T;onSelect:(value:T)=>void;testIdPrefix:string}) {
  if (options.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{options.map((option)=>{const active=option.value===value;return <button key={option.value} type="button" aria-pressed={active} data-testid={`${testIdPrefix}-${option.tagId}`} onClick={()=>onSelect(option.value)} className={`min-h-11 rounded-button border px-2.5 py-1.5 text-xs transition-colors ${active?'border-primary bg-primary-soft font-semibold text-primary':'border-gray-200 text-body hover:border-primary/40'}`}>{option.label}</button>;})}</div>;
}

function DiscoveryValidationSummary({authoring,taxonomy,taxonomyError,text}:{authoring:CreatorDiscoveryAuthoringV2;taxonomy:CommunityTaxonomyV2|null;taxonomyError:string|null;text:(zh:string,en:string)=>string}) {
  if (!taxonomy) {
    return <p role="status" data-testid="discovery-validation-summary" className="rounded-card border border-error/30 bg-error/5 p-3 text-sm text-error">{text('发现元数据不可用：taxonomy-v2 未加载，无法继续发布流程。','Discovery unavailable: taxonomy-v2 did not load; the publish flow cannot continue.')}{taxonomyError&&<span className="block break-all font-mono text-xs">{taxonomyError}</span>}</p>;
  }
  const issues = discoveryIssuesV2(authoring, taxonomy);
  if (issues.length > 0) {
    const missing = issues.map((code)=>code==='missing_style'?text('整体风格','overall style'):code==='missing_shape'?text('推荐甲型','recommended shape'):text('权利状态（PENDING）','rights status (PENDING)'));
    return <p role="status" data-testid="discovery-validation-summary" className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{text('发现元数据未完成：','Discovery incomplete: ')}{missing.join(' · ')}</p>;
  }
  return <p role="status" data-testid="discovery-validation-summary" className="rounded-card border border-success/30 bg-success/10 p-3 text-sm text-success">{text('发现元数据完整：','Discovery ready: ')}{authoring.styleIds.length} {text('个整体风格','styles')} · {authoring.recommendedShapeIds.length} {text('个推荐甲型','shapes')} · {authoring.rights} · {authoring.makeability}</p>;
}
