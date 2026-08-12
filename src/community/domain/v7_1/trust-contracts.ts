/** GEN-V7.1-03: immutable approval, result, event and governance contracts. */
export const APPROVAL_DECISIONS_V1 = ['APPROVED', 'CHANGE_REQUESTED'] as const;
export const REAL_RESULT_STATUSES_V1 = ['DRAFT', 'VERIFIED', 'PUBLIC'] as const;
export const GOVERNANCE_ACTIONS_V1 = ['REPORTED','UNDER_REVIEW','HIDDEN','REMOVED','RESTORED'] as const;
export const COMMUNITY_EVENT_TYPES_V1 = ['look_view','look_save','look_customize','design_publish','share_client','client_approve','client_change_request','real_result_created','real_result_verified'] as const;

export interface ConfirmedDesignSnapshotV7 {
  schemaVersion: 1; snapshotId: string; designVersionId: string; designId: string;
  editorDocSha256: string; rendererRevision: string; previewAssetIds: string[];
  confirmedByIdentityRef?: string; confirmedAt: string;
}
export interface ApprovalEventV1 {
  schemaVersion: 1; approvalEventId: string; shareLinkId: string; designVersionId: string;
  decision: typeof APPROVAL_DECISIONS_V1[number]; note?: string; snapshotId?: string;
  idempotencyKey: string; actorRef: string; createdAt: string;
}
export interface RealResultV1 {
  schemaVersion: 1; realResultId: string; lookId: string; designVersionId: string;
  fulfillmentRef: string; creatorProfileId: string; imageRefs: Array<{assetId:string;revision:number;sha256:string;mimeType:'image/jpeg'|'image/png'|'image/webp';width:number;height:number}>;
  consentDeclared: boolean; moderationCleared: boolean; status: typeof REAL_RESULT_STATUSES_V1[number]; createdAt: string; verifiedAt?: string;
}
export interface CommunityEventV1 {
  schemaVersion: 1; eventId: string; eventType: typeof COMMUNITY_EVENT_TYPES_V1[number];
  actorRef: string; subjectRef: string; source: string; designVersionId?: string; sessionId: string;
  idempotencyKey: string; demo: boolean; createdAt: string;
}
export interface GovernanceAuditV1 {
  schemaVersion: 1; auditId: string; subjectType: 'PUBLISHED_LOOK'|'CREATOR_PROFILE'|'REAL_RESULT'; subjectId: string;
  action: typeof GOVERNANCE_ACTIONS_V1[number]; actorRef: string; reasonCode: string;
  objectVersion: number; idempotencyKey: string; createdAt: string;
}
export interface TrustContractBundleV1 { schemaVersion:1; snapshots:ConfirmedDesignSnapshotV7[]; approvals:ApprovalEventV1[]; realResults:RealResultV1[]; events:CommunityEventV1[]; audits:GovernanceAuditV1[] }

type R=Record<string,unknown>;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/; const SHA=/^[0-9a-f]{64}$/; const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const record=(v:unknown):v is R=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:R,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const id=(v:unknown)=>typeof v==='string'&&ID.test(v); const time=(v:unknown)=>typeof v==='string'&&ISO.test(v);
const unique=(values:string[])=>new Set(values).size===values.length;

export function parseConfirmedDesignSnapshotV7(v:unknown):ConfirmedDesignSnapshotV7|null {
  if(!record(v)||!keys(v,['schemaVersion','snapshotId','designVersionId','designId','editorDocSha256','rendererRevision','previewAssetIds','confirmedByIdentityRef','confirmedAt'])||v.schemaVersion!==1||!id(v.snapshotId)||!id(v.designVersionId)||!id(v.designId)||typeof v.editorDocSha256!=='string'||!SHA.test(v.editorDocSha256)||!id(v.rendererRevision)||!Array.isArray(v.previewAssetIds)||!v.previewAssetIds.every(id)||!unique(v.previewAssetIds as string[])||(v.confirmedByIdentityRef!==undefined&&!id(v.confirmedByIdentityRef))||!time(v.confirmedAt))return null; return structuredClone(v) as unknown as ConfirmedDesignSnapshotV7;
}
export function parseApprovalEventV1(v:unknown):ApprovalEventV1|null {
  if(!record(v)||!keys(v,['schemaVersion','approvalEventId','shareLinkId','designVersionId','decision','note','snapshotId','idempotencyKey','actorRef','createdAt'])||v.schemaVersion!==1||!id(v.approvalEventId)||!id(v.shareLinkId)||!id(v.designVersionId)||!APPROVAL_DECISIONS_V1.includes(v.decision as never)||(v.note!==undefined&&(typeof v.note!=='string'||v.note.length>1000))||(v.snapshotId!==undefined&&!id(v.snapshotId))||!id(v.idempotencyKey)||!id(v.actorRef)||!time(v.createdAt))return null;
  if((v.decision==='APPROVED')!==(typeof v.snapshotId==='string'))return null; return structuredClone(v) as unknown as ApprovalEventV1;
}
export function parseRealResultV1(v:unknown):RealResultV1|null {
  if(!record(v)||!keys(v,['schemaVersion','realResultId','lookId','designVersionId','fulfillmentRef','creatorProfileId','imageRefs','consentDeclared','moderationCleared','status','createdAt','verifiedAt'])||v.schemaVersion!==1||![v.realResultId,v.lookId,v.designVersionId,v.fulfillmentRef,v.creatorProfileId].every(id)||!Array.isArray(v.imageRefs)||v.imageRefs.length<1||v.imageRefs.length>5||typeof v.consentDeclared!=='boolean'||typeof v.moderationCleared!=='boolean'||!REAL_RESULT_STATUSES_V1.includes(v.status as never)||!time(v.createdAt)||(v.verifiedAt!==undefined&&!time(v.verifiedAt)))return null;
  for(const image of v.imageRefs){if(!record(image)||!keys(image,['assetId','revision','sha256','mimeType','width','height'])||!id(image.assetId)||!Number.isInteger(image.revision)||(image.revision as number)<1||typeof image.sha256!=='string'||!SHA.test(image.sha256)||!['image/jpeg','image/png','image/webp'].includes(image.mimeType as string)||!Number.isInteger(image.width)||!Number.isInteger(image.height))return null;}
  if(v.status!=='DRAFT'&&(!v.consentDeclared||!v.moderationCleared||!v.verifiedAt))return null; return structuredClone(v) as unknown as RealResultV1;
}
export function parseCommunityEventV1(v:unknown):CommunityEventV1|null {if(!record(v)||!keys(v,['schemaVersion','eventId','eventType','actorRef','subjectRef','source','designVersionId','sessionId','idempotencyKey','demo','createdAt'])||v.schemaVersion!==1||!id(v.eventId)||!COMMUNITY_EVENT_TYPES_V1.includes(v.eventType as never)||![v.actorRef,v.subjectRef,v.source,v.sessionId,v.idempotencyKey].every(id)||(v.designVersionId!==undefined&&!id(v.designVersionId))||typeof v.demo!=='boolean'||!time(v.createdAt))return null;return structuredClone(v) as unknown as CommunityEventV1;}
export function parseGovernanceAuditV1(v:unknown):GovernanceAuditV1|null {if(!record(v)||!keys(v,['schemaVersion','auditId','subjectType','subjectId','action','actorRef','reasonCode','objectVersion','idempotencyKey','createdAt'])||v.schemaVersion!==1||!id(v.auditId)||!['PUBLISHED_LOOK','CREATOR_PROFILE','REAL_RESULT'].includes(v.subjectType as string)||!id(v.subjectId)||!GOVERNANCE_ACTIONS_V1.includes(v.action as never)||![v.actorRef,v.reasonCode,v.idempotencyKey].every(id)||!Number.isInteger(v.objectVersion)||(v.objectVersion as number)<1||!time(v.createdAt))return null;return structuredClone(v) as unknown as GovernanceAuditV1;}
export function parseTrustContractBundleV1(v:unknown):TrustContractBundleV1|null {if(!record(v)||!keys(v,['schemaVersion','snapshots','approvals','realResults','events','audits'])||v.schemaVersion!==1)return null;const parsers=[parseConfirmedDesignSnapshotV7,parseApprovalEventV1,parseRealResultV1,parseCommunityEventV1,parseGovernanceAuditV1] as const;const arrays=[v.snapshots,v.approvals,v.realResults,v.events,v.audits];if(arrays.some(a=>!Array.isArray(a)))return null;for(let i=0;i<arrays.length;i++)if(!(arrays[i] as unknown[]).every(item=>parsers[i](item as never)))return null;const primaryKeys=['snapshotId','approvalEventId','realResultId','eventId','auditId'];const all=(arrays as unknown[][]).flatMap((a,index)=>a.map(item=>(item as R)[primaryKeys[index]] as string));if(!unique(all))return null;return structuredClone(v) as unknown as TrustContractBundleV1;}
