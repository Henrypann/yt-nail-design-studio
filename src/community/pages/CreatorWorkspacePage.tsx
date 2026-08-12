import { Children, useMemo, useState, type ReactNode } from 'react';
import { Archive, Eye, EyeOff, FilePlus2, LockKeyhole, Send, Sparkles } from 'lucide-react';
import { Button, Input, Tabs, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { CANONICAL_USE_DEMO_RELEASE_RECORD_V1 } from '@/integration/community-studio/canonical-use-demo';
import { Routes } from '@/app/routes';
import { createClientShareV1 } from '@/studio/approval';
import { persistClientApprovalStoreV1, readClientApprovalStoreV1 } from '@/studio/approval';
import { buildPublishPackageV1, createDeterministicPublishIdFactoryV1, type PublishPackageV1 } from '@/studio/publishing';
import { createBrowserSha256V1 } from '@/studio/versioning';
import {
  createCreatorPublicationDraftV1, publishCreatorDraftV1, setCreatorLookHiddenV1,
  updateCreatorPublicationDraftV1, type CreatorPublicationDraftV1, type CreatorPublicationSourceV1,
  type CreatorPublicationStoreV1,
} from '../domain/v7_1/creator-publication';
import { persistCreatorPublicationStoreV1, readCreatorPublicationStoreV1 } from '../data/creator-publication-repository';
import { readGovernanceStoreV1, persistGovernanceStoreV1 } from '../data/governance-repository';
import { publicationReviewClearedV1, submitPublicationReviewV1 } from '../domain/v7_1/governance';

const CREATOR_PROFILE_ID = 'profile.local-demo.creator';
const FALLBACK_PIXEL = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

async function createDemoPackage(): Promise<PublishPackageV1> {
  const sha = createBrowserSha256V1();
  const bytesSha = async (bytes: Uint8Array) => {
    const stableBytes = Uint8Array.from(bytes);
    const digest = await crypto.subtle.digest('SHA-256', stableBytes.buffer);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  };
  const result = await buildPublishPackageV1(CANONICAL_USE_DEMO_RELEASE_RECORD_V1, {
    rendererRevision: 'creator-local-preview-v1', renderer3d: null,
    renderer2d: { rendererId: 'creator.local-2d', render: (request) => ({ ok: true, output: { bytes: new Uint8Array([...FALLBACK_PIXEL, request.kind === 'COVER' ? 1 : 2]), mimeType: 'image/png', width: request.width, height: request.height, colorSpace: 'srgb', fidelity: 'APPROXIMATE' } }) },
    sha256: bytesSha, nextAssetId: createDeterministicPublishIdFactoryV1(),
    resolveGeometry: () => ({ status: 'resolved', shapeId: 'almond', lengthId: 'medium' }),
  });
  if (!result.ok) throw new Error(result.message);
  // Ensure the browser SHA dependency remains exercised by the runtime boundary.
  await sha(JSON.stringify(result.package.assetManifest));
  return result.package;
}

export default function CreatorWorkspacePage() {
  const { text } = useLocale();
  const toast = useToast();
  const initial = useMemo(readCreatorPublicationStoreV1, []);
  const [store, setStore] = useState<CreatorPublicationStoreV1>(initial.store);
  const [tab, setTab] = useState('drafts');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [governance, setGovernance] = useState(() => readGovernanceStoreV1().store);
  const active = store.drafts.find((item) => item.draftId === activeId) ?? null;

  const save = (next: CreatorPublicationStoreV1, message: string) => {
    const persisted = persistCreatorPublicationStoreV1(next);
    if (!persisted.ok) { toast.error(text('保存失败，请重试', 'Save failed. Try again.')); return false; }
    setStore(persisted.value); toast.success(message); return true;
  };

  const startDraft = async () => {
    setBusy(true);
    try {
      const pkg = await createDemoPackage();
      const id = `draft.${crypto.randomUUID()}`;
      const created = createCreatorPublicationDraftV1({ store, draftId: id, creatorProfileId: CREATOR_PROFILE_ID, package: pkg, now: new Date().toISOString() });
      if (!created.ok || !save(created.value, text('已创建 PRIVATE 发布草稿', 'PRIVATE publication draft created'))) return;
      setActiveId(id); setTab('drafts');
    } catch { toast.error(text('无法生成发布包', 'Could not create a publish package')); }
    finally { setBusy(false); }
  };

  const update = (patch: Parameters<typeof updateCreatorPublicationDraftV1>[0]['patch']) => {
    if (!active) return;
    const result = updateCreatorPublicationDraftV1({ store, draftId: active.draftId, patch, now: new Date().toISOString(), publicGovernanceCleared: publicationReviewClearedV1(governance,active.draftId,active.creatorProfileId,active.contentRevision) });
    if (!result.ok) { toast.warning(result.message); return; }
    save(result.value, text('草稿已保存', 'Draft saved'));
  };

  const publish = () => {
    if (!active) return;
    const result = publishCreatorDraftV1({ store, draftId: active.draftId, lookId: `look.${crypto.randomUUID()}`, now: new Date().toISOString(), publicGovernanceCleared: publicationReviewClearedV1(governance,active.draftId,active.creatorProfileId,active.contentRevision) });
    if (!result.ok) { toast.warning(text('请完成标题、来源和版权声明', 'Complete title, source and copyright declarations')); return; }
    if (save(result.value, text('已发布到创作者作品库', 'Published to creator library'))) { setActiveId(null); setTab('published'); }
  };
  const submitReview=()=>{if(!active)return;const result=submitPublicationReviewV1(governance,{reviewId:`review.${crypto.randomUUID()}`,auditId:`audit.${crypto.randomUUID()}`,draftId:active.draftId,creatorProfileId:active.creatorProfileId,draftRevision:active.contentRevision,now:new Date().toISOString()});if(!result.ok||!persistGovernanceStoreV1(result.value)){toast.error(text('提交审核失败','Review submission failed'));return}setGovernance(result.value);toast.success(text('PUBLIC 审核已提交','PUBLIC review submitted'));};

  const toggleHidden = (lookId: string, hidden: boolean) => {
    const result = setCreatorLookHiddenV1(store, lookId, hidden, new Date().toISOString());
    if (result.ok) save(result.value, hidden ? text('作品已隐藏', 'Look hidden') : text('作品已恢复', 'Look restored'));
  };
  const shareLook = async (designVersionId:string) => {
    const publication=store.looks.find(look=>look.designVersionId===designVersionId);if(!publication)return;
    const rawToken=[...crypto.getRandomValues(new Uint8Array(24))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(rawToken));const tokenHash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
    const approvals=readClientApprovalStoreV1();if(approvals.corrupted){toast.error(text('分享仓储损坏','Share store corrupted'));return;}
    const pkg=await createDemoPackage();if(pkg.designVersionId!==publication.designVersionId){toast.error(text('固定版本发布包不可用','Fixed-version package unavailable'));return;}const now=new Date(),expires=new Date(now.getTime()+7*24*60*60*1000);
    const created=createClientShareV1({store:approvals.store,shareLinkId:`share.${crypto.randomUUID()}`,tokenHash,editorDocSha256:CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.editorDocRef.sha256,package:pkg,now:now.toISOString(),expiresAt:expires.toISOString()});
    if(!created.ok||!persistClientApprovalStoreV1(created.value).ok){toast.error(text('创建分享失败','Could not create share'));return;}
    const url=new URL(Routes.communityClientShare(rawToken),window.location.origin).toString();await navigator.clipboard?.writeText(url);toast.success(text('顾客确认链接已复制（7 天有效）','Client approval link copied (7 days)'));
  };

  const visibleLooks = store.looks.filter((look) => tab === 'hidden' ? look.status === 'HIDDEN' : look.status === 'PUBLISHED');
  return (
    <div className="space-y-5" data-testid="creator-workspace-page">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-primary/15 bg-gradient-to-br from-white to-primary-soft p-5">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Creator Workspace · Local prototype</p><h1 className="mt-1 text-h1 font-bold text-ink">{text('发布与作品管理', 'Publish and manage looks')}</h1><p className="mt-2 max-w-2xl text-sm text-body">{text('从固定 DesignVersion 的 Publish Package 创建作品。当前只开放 PRIVATE / UNLISTED；PUBLIC 需等待治理门禁。', 'Create looks from a fixed DesignVersion Publish Package. PRIVATE / UNLISTED only; PUBLIC requires governance.')}</p></div>
        <Button onClick={startDraft} loading={busy} className="min-h-11"><FilePlus2 size={16} />{text('新建发布', 'New publication')}</Button>
      </header>
      {initial.corrupted && <p role="alert" className="rounded-card border border-error/30 bg-error/5 p-3 text-sm text-error">{text('本地发布数据损坏，已安全只读为空；未覆盖原记录。', 'Local publication data is corrupted and was not overwritten.')}</p>}
      <Tabs activeKey={tab} onChange={setTab} items={[{key:'drafts',label:`${text('草稿','Drafts')} ${store.drafts.length}`},{key:'published',label:`${text('已发布','Published')} ${store.looks.filter((l)=>l.status==='PUBLISHED').length}`},{key:'hidden',label:`${text('已隐藏','Hidden')} ${store.looks.filter((l)=>l.status==='HIDDEN').length}`}]} />
      {active ? <PublishWizard draft={active} governanceStatus={governance.publicationReviews.slice().reverse().find(review=>review.draftId===active.draftId&&review.draftRevision===active.contentRevision)?.status} onSubmitReview={submitReview} onUpdate={update} onPublish={publish} onClose={() => setActiveId(null)} text={text} /> : tab === 'drafts' ? (
        <CardGrid empty={text('还没有发布草稿。新建发布会从固定版本生成可解释的 2D Publish Package。','No publication drafts yet.')}>
          {store.drafts.map((draft) => <button key={draft.draftId} onClick={()=>setActiveId(draft.draftId)} className="min-h-32 rounded-card border border-gray-200 bg-white p-4 text-left hover:border-primary/40"><span className="rounded-full bg-primary-soft px-2 py-1 text-nano font-semibold text-primary">Step {draft.step}/3 · {draft.visibility}</span><h2 className="mt-3 font-semibold text-ink">{draft.title || text('未命名发布草稿','Untitled publication')}</h2><p className="mt-1 text-xs text-mute">{draft.package.designVersionId}</p></button>)}
        </CardGrid>
      ) : <CardGrid empty={tab==='hidden'?text('没有已隐藏作品','No hidden looks'):text('还没有已发布作品','No published looks')}>
        {visibleLooks.map((look)=><article key={look.lookId} className="rounded-card border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-gray-100 px-2 py-1 text-nano font-semibold text-gray-600">{look.visibility}</span><h2 className="mt-3 font-semibold text-ink">{look.title}</h2><p className="mt-1 text-xs text-mute">{look.designVersionId}</p></div><div className="flex flex-wrap gap-2">{look.status==='PUBLISHED'&&<Button variant="secondary" onClick={()=>void shareLook(look.designVersionId)}><Send size={14}/>{text('分享确认','Share')}</Button>}{look.status==='HIDDEN'?<Button variant="secondary" onClick={()=>toggleHidden(look.lookId,false)}><Eye size={14}/>{text('恢复','Restore')}</Button>:<Button variant="secondary" onClick={()=>toggleHidden(look.lookId,true)}><EyeOff size={14}/>{text('隐藏','Hide')}</Button>}</div></div></article>)}
      </CardGrid>}
    </div>
  );
}

function CardGrid({children,empty}:{children:ReactNode;empty:string}) { return <div className="grid gap-3 md:grid-cols-2">{Children.count(children) > 0 ? children : <div className="col-span-full rounded-card border border-dashed border-gray-300 bg-surface-soft p-10 text-center text-sm text-mute"><Archive className="mx-auto mb-3"/>{empty}</div>}</div>; }

function PublishWizard({draft,governanceStatus,onSubmitReview,onUpdate,onPublish,onClose,text}:{draft:CreatorPublicationDraftV1;governanceStatus?:'PENDING'|'CLEARED'|'REJECTED';onSubmitReview:()=>void;onUpdate:(patch:Parameters<typeof updateCreatorPublicationDraftV1>[0]['patch'])=>void;onPublish:()=>void;onClose:()=>void;text:(zh:string,en:string)=>string}) {
  const sources: CreatorPublicationSourceV1[] = ['ORIGINAL','REMIX','IMPORTED','AI_ASSISTED'];
  return <section className="rounded-card border border-primary/20 bg-white p-5" data-testid="creator-publish-wizard"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold text-primary">{text('三步发布','Three-step publish')}</p><h2 className="text-h2 font-bold text-ink">{draft.title || text('未命名发布草稿','Untitled publication')}</h2></div><Button variant="ghost" onClick={onClose}>{text('返回列表','Back')}</Button></div><ol className="mb-6 grid grid-cols-3 gap-2">{[text('元数据','Metadata'),text('可见性','Visibility'),text('来源确认','Source')].map((label,index)=><li key={label} className={`rounded-button px-3 py-2 text-center text-xs font-semibold ${draft.step===index+1?'bg-primary text-white':draft.step>index+1?'bg-success-soft text-success':'bg-gray-100 text-mute'}`}>{index+1}. {label}</li>)}</ol>
    {draft.step===1&&<div className="space-y-4"><Input label={text('作品标题','Title')} value={draft.title} maxLength={80} onChange={(event)=>onUpdate({title:event.target.value})}/><Input label={text('标签（逗号分隔，最多 12 个）','Tags (comma-separated, max 12)')} value={draft.tags.join(', ')} onChange={(event)=>onUpdate({tags:event.target.value.split(',').map(v=>v.trim()).filter(Boolean).slice(0,12)})}/><PackageSummary draft={draft}/><Button disabled={!draft.title.trim()} onClick={()=>onUpdate({step:2})}>{text('下一步：可见性','Next: visibility')}</Button></div>}
    {draft.step===2&&<div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{(['PRIVATE','UNLISTED','PUBLIC'] as const).map((visibility)=><button key={visibility} disabled={visibility==='PUBLIC'&&governanceStatus!=='CLEARED'} onClick={()=>onUpdate({visibility})} className={`min-h-24 rounded-card border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${draft.visibility===visibility?'border-primary bg-primary-soft':'border-gray-200'}`}><LockKeyhole size={17} className="text-primary"/><strong className="mt-2 block text-sm">{visibility}</strong><span className="text-xs text-mute">{visibility==='PRIVATE'?text('仅自己管理','Only you can manage'):visibility==='UNLISTED'?text('持链接可查看；不进入 Explore','Link access; not indexed'):text('完成来源声明并通过审核后进入 Explore','Indexed after source declaration and clearance')}</span></button>)}</div><div className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><strong>PUBLIC review · {governanceStatus??'NOT_SUBMITTED'}</strong><p className="mt-1">{text('PUBLIC 审核绑定当前内容修订；请先在下一步完成来源与版权声明。','PUBLIC review is bound to the exact content revision. Complete source and copyright declarations next.')}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={()=>onUpdate({step:1})}>{text('上一步','Back')}</Button><Button onClick={()=>onUpdate({step:3})}>{text('下一步：来源','Next: source')}</Button></div></div>}
    {draft.step===3&&<div className="space-y-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{sources.map((source)=><button key={source} onClick={()=>onUpdate({sourceType:source})} className={`min-h-11 rounded-button border px-2 text-xs font-semibold ${draft.sourceType===source?'border-primary bg-primary-soft text-primary':'border-gray-200 text-body'}`}>{source}</button>)}</div>{draft.sourceType!=='ORIGINAL'&&<Input label={text('来源说明 / Attribution','Source attribution')} value={draft.sourceAttribution??''} onChange={(event)=>onUpdate({sourceAttribution:event.target.value})}/>}<label className="flex min-h-11 items-center gap-3 rounded-button border border-gray-200 px-3 text-sm"><input type="checkbox" className="accent-primary" checked={draft.copyrightDeclared} onChange={(e)=>onUpdate({copyrightDeclared:e.target.checked})}/>{text('我确认拥有发布或引用该内容的权利','I have the right to publish or reference this content')}</label><label className="flex min-h-11 items-center gap-3 rounded-button border border-gray-200 px-3 text-sm"><input type="checkbox" className="accent-primary" checked={draft.sourceDeclared} onChange={(e)=>onUpdate({sourceDeclared:e.target.checked})}/>{text('来源类型与说明真实完整','Source type and attribution are accurate')}</label><div className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><strong>PUBLIC review · {governanceStatus??'NOT_SUBMITTED'} · r{draft.contentRevision}</strong><div className="mt-2"><Button variant="secondary" disabled={!draft.copyrightDeclared||!draft.sourceDeclared||governanceStatus==='PENDING'||governanceStatus==='CLEARED'} onClick={onSubmitReview}>{governanceStatus==='REJECTED'?text('重新提交当前修订','Resubmit this revision'):text('提交当前修订审核','Submit this revision')}</Button></div></div><div className="flex gap-2"><Button variant="secondary" onClick={()=>onUpdate({step:2})}>{text('上一步','Back')}</Button><Button disabled={!draft.copyrightDeclared||!draft.sourceDeclared||(draft.visibility==='PUBLIC'&&governanceStatus!=='CLEARED')} onClick={onPublish}><Send size={15}/>{text('发布到作品库','Publish to library')}</Button></div></div>}
  </section>;
}

function PackageSummary({draft}:{draft:CreatorPublicationDraftV1}) { return <div className="grid gap-2 rounded-card bg-surface-soft p-4 sm:grid-cols-3"><div><span className="text-nano text-mute">DesignVersion</span><strong className="block text-xs text-body">{draft.package.designVersionId}</strong></div><div><span className="text-nano text-mute">Fidelity</span><strong className="block text-xs text-body">{draft.package.fidelity}</strong></div><div><span className="text-nano text-mute">Derived assets</span><strong className="block text-xs text-body"><Sparkles size={13} className="mr-1 inline"/>{1+draft.package.details.length}</strong></div></div>; }
