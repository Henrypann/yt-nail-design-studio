import type { CanonicalLocale, MessageCatalogV1 } from './types';
import { SEMANTIC_EN_MESSAGES, SEMANTIC_ZH_MESSAGES } from './semantic-messages';

/** Product chrome only. Domain labels and look metadata stay in their own registries. */
export const ZH_CN_MESSAGES = {
    'common.language': '语言', 'common.loading': '加载中…', 'common.retry': '重试', 'common.cancel': '取消',
    'common.confirm': '确认', 'common.close': '关闭', 'common.clear': '清除', 'common.back': '返回',
    'common.save': '保存', 'common.saved': '已保存', 'common.create': '创建', 'common.delete': '删除',
    'common.edit': '编辑', 'common.add': '添加', 'common.use': '使用', 'common.percent': '%', 'common.mm': 'mm', 'common.search': '搜索', 'common.next': '下一步', 'common.previous': '上一步',
    'common.empty': '暂无内容', 'common.error': '出了点问题', 'common.unknownError': '未知错误，请重试。',
    'app.language.zh': '中文', 'app.language.en': 'EN', 'nav.studio': 'Studio', 'nav.community': 'Community',
    'nav.home': '首页', 'nav.designs': '设计', 'nav.customers': '客户', 'nav.devices': '设备',
    'nav.logout': '退出登录', 'wizard.title': '快速建稿', 'wizard.loading': '正在打开快速建稿…',
    'wizard.empty': '该风格下暂无模板。', 'wizard.applyTemplate': '应用此模板', 'wizard.resumeDraft': '恢复草稿',
    'wizard.editorPreflight': 'Editor 预检', 'editor.loading': '正在打开编辑器…', 'editor.preview': '预览',
    'editor.saveFailed': '保存失败，请重试。', 'community.discover': '发现', 'community.search': '搜索款式',
    'community.empty': '暂无符合条件的款式', 'community.loadFailed': '加载失败，请重试。',
    'community.import': '导入到 Studio', 'community.return': '返回 Community', 'share.invalid': '分享链接无效',
    'share.expired': '分享已过期', 'share.revoked': '分享已撤销', 'share.notFound': '找不到该分享',
    'validation.blocked': '当前操作被安全阻断。', 'validation.incomplete': '信息不完整，暂时无法继续。',
    'toast.saved': '已保存', 'toast.saveFailed': '保存失败，请重试。', 'toast.copyFailed': '复制失败，请手动复制。',
    'status.available': '可用', 'status.unavailable': '不可用', 'status.pending': '待审核',
    'shape.title': '甲型', 'length.title': '长度', 'shape.more': '更多甲型（{count}）',
    'community.boardSaveReference': '保存到 Nail Board（引用款式，不复制设计内容）',
    'community.boardSaveUnavailable': '保存到 Nail Board 需要注入 onSave（当前不可用）',
  ...SEMANTIC_ZH_MESSAGES,
} as const;
export const ZH_CN: MessageCatalogV1 = { schemaVersion: 1, locale: 'zh-CN', revision: 1, messages: ZH_CN_MESSAGES };

export const EN_US_MESSAGES = {
    'common.language': 'Language', 'common.loading': 'Loading…', 'common.retry': 'Retry', 'common.cancel': 'Cancel',
    'common.confirm': 'Confirm', 'common.close': 'Close', 'common.clear': 'Clear', 'common.back': 'Back',
    'common.save': 'Save', 'common.saved': 'Saved', 'common.create': 'Create', 'common.delete': 'Delete',
    'common.edit': 'Edit', 'common.add': 'Add', 'common.use': 'Use', 'common.percent': '%', 'common.mm': 'mm', 'common.search': 'Search', 'common.next': 'Next', 'common.previous': 'Previous',
    'common.empty': 'Nothing here yet', 'common.error': 'Something went wrong', 'common.unknownError': 'Unknown error. Try again.',
    'app.language.zh': '中文', 'app.language.en': 'EN', 'nav.studio': 'Studio', 'nav.community': 'Community',
    'nav.home': 'Home', 'nav.designs': 'Designs', 'nav.customers': 'Customers', 'nav.devices': 'Devices',
    'nav.logout': 'Log out', 'wizard.title': 'Quick Start', 'wizard.loading': 'Opening Quick Start…',
    'wizard.empty': 'No templates are available for this style.', 'wizard.applyTemplate': 'Use this template', 'wizard.resumeDraft': 'Resume draft',
    'wizard.editorPreflight': 'Editor preflight', 'editor.loading': 'Opening editor…', 'editor.preview': 'Preview',
    'editor.saveFailed': 'Could not save. Try again.', 'community.discover': 'Discover', 'community.search': 'Search looks',
    'community.empty': 'No looks match these filters', 'community.loadFailed': 'Could not load. Try again.',
    'community.import': 'Import to Studio', 'community.return': 'Back to Community', 'share.invalid': 'Invalid share link',
    'share.expired': 'Share link expired', 'share.revoked': 'Share link revoked', 'share.notFound': 'Share not found',
    'validation.blocked': 'This action was blocked for safety.', 'validation.incomplete': 'Some information is missing. You cannot continue yet.',
    'toast.saved': 'Saved', 'toast.saveFailed': 'Could not save. Try again.', 'toast.copyFailed': 'Copy failed. Copy it manually.',
    'status.available': 'Available', 'status.unavailable': 'Unavailable', 'status.pending': 'Pending review',
    'shape.title': 'NAIL SHAPE', 'length.title': 'LENGTH', 'shape.more': 'More shapes ({count})',
    'community.boardSaveReference': 'Save to Nail Boards (reference only, never a content copy)',
    'community.boardSaveUnavailable': 'Save to Nail Boards needs an injected onSave (currently unavailable)',
  ...SEMANTIC_EN_MESSAGES,
} satisfies Record<keyof typeof ZH_CN_MESSAGES, string>;
export const EN_US: MessageCatalogV1 = { schemaVersion: 1, locale: 'en-US', revision: 1, messages: EN_US_MESSAGES };

/** Explicit map intentionally forces a compile-time catalog when registry grows. */
export const CATALOGS: Record<CanonicalLocale, MessageCatalogV1> = { 'zh-CN': ZH_CN, 'en-US': EN_US };
