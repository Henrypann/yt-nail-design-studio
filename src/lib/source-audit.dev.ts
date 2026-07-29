import type { SourceRef } from './page-requirements';

export type SourceAuditStatus = 'verified' | 'stale' | 'missing' | 'unreviewed' | 'checking';

export interface SourceAuditResult {
  ref: SourceRef;
  status: SourceAuditStatus;
  actualHash?: string;
  message: string;
}

const sourceLoaders = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
});

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

export async function auditSourceRef(ref: SourceRef): Promise<SourceAuditResult> {
  const loader = sourceLoaders[`/${ref.path}`];
  if (!loader) {
    return { ref, status: 'missing', message: '源码文件不存在或不在 DEV 审计范围内' };
  }
  const raw = await loader();
  if (typeof raw !== 'string') {
    return { ref, status: 'missing', message: '无法读取源码文本' };
  }
  const actualHash = await sha256(raw);
  if (!ref.reviewedHash.startsWith('sha256:')) {
    return { ref, status: 'unreviewed', actualHash, message: '尚未记录人工复核指纹' };
  }
  if (actualHash !== ref.reviewedHash) {
    return { ref, status: 'stale', actualHash, message: '源码已变化，需要重新核对 PRD 文字' };
  }
  return { ref, status: 'verified', actualHash, message: '源码与最近人工复核版本一致' };
}

export async function auditSourceRefs(refs: SourceRef[]): Promise<SourceAuditResult[]> {
  return Promise.all(refs.map(auditSourceRef));
}
