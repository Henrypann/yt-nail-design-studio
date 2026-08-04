/**
 * `/design/community` 社区页（社区demo P0，纯 Mock）
 *
 * 从选款页「进入社区查看更多模板」跳转而来。数据为静态 Mock，不读 material-library，
 * 不接后端，不提供真实「应用」能力——避免把未接通的功能伪装成可用功能。
 */

import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { useWizardStore } from '@/studio/wizard/wizard-store';

interface CommunityMockEntry {
  id: string;
  name: string;
  author: string;
  tagLabel: string;
}

/** 社区示例数据（Mock，非真实模板库，仅用于演示社区页外观） */
const COMMUNITY_MOCK: CommunityMockEntry[] = [
  { id: 'c1', name: '奶油法式渐变', author: '@lily_nails', tagLabel: '当下流行' },
  { id: 'c2', name: '樱花贝壳甲', author: '@studio_momo', tagLabel: '甜美' },
  { id: 'c3', name: '大理石纹理', author: '@artdeco_nail', tagLabel: '当下流行' },
  { id: 'c4', name: '糖霜奶油裱花', author: '@sweet_petal', tagLabel: '甜美' },
  { id: 'c5', name: '波普糖果色块', author: '@popcolor_studio', tagLabel: '当下流行' },
  { id: 'c6', name: '珍珠光泽渐层', author: '@pearl_grace', tagLabel: '甜美' },
];

export default function CommunityPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const appliedShape = useWizardStore((s) => s.appliedShape);
  const appliedLength = useWizardStore((s) => s.appliedLength);
  /* 全局侧栏「Community」入口没有 Wizard 上下文，此时不应回跳选款页（appliedShape 为空会被
   * TemplateGalleryPage 兜底逐出到 /design/new）；只有从选款页跳转过来时才回选款页。 */
  const hasWizardContext = Boolean(appliedShape && appliedLength);
  const backTarget = hasWizardContext ? Routes.designTemplates : Routes.designs;
  const backLabel = hasWizardContext ? '返回选款' : '返回我的设计';

  const handleCardClick = () => {
    toast.info('社区功能目前仅为演示，暂未接入真实模板与线上分享能力。');
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4" data-debug-id="studio.design-community">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate(backTarget)}
          className="flex items-center gap-1 rounded-button px-2 py-1 text-xs text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </button>
        <span className="h-4 w-px bg-gray-200" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900">社区</h1>
          <p className="mt-0.5 text-xs text-gray-500">看看其他美甲师分享的方案（社区示例 · Mock，非真实模板）</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COMMUNITY_MOCK.map((entry) => (
          <button
            key={entry.id}
            onClick={handleCardClick}
            className="flex flex-col overflow-hidden rounded-card border border-gray-200 bg-white text-left transition-colors duration-fast hover:border-primary/60"
          >
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-50 text-3xl">💅</div>
            <div className="flex flex-col gap-1 p-3">
              <span className="truncate text-sm font-medium text-gray-900">{entry.name}</span>
              <span className="truncate text-[11px] text-gray-500">{entry.author}</span>
              <Badge variant="gray" className="w-fit text-[10px]">{entry.tagLabel}</Badge>
            </div>
          </button>
        ))}
      </div>

      <p className="pt-2 text-center text-[10px] text-gray-400">社区示例 · Mock 数据，仅用于演示页面结构，不代表真实上线功能</p>

      <div className="flex justify-center pb-2">
        <Button variant="ghost" onClick={() => navigate(backTarget)}>
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
