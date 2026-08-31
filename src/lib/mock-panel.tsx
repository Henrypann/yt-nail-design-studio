/**
 * Mock 场景注入（基础框架 · 开发态）—— 场景定义 + 状态存储
 *
 * 依据：DEV-PLAN §1 范围锚点 —— 凡「后端就绪后」能力均以 Mock 场景注入驱动，
 * UI 零改动切换。消费方读取 useMockScenarios() 的开关/参数，触发对应异常 UI
 * （渲染失败 / 单指失败降级 / 保存失败重试 / 加载超时 等）。
 *
 * v1.5.1：面板 UI 已升级为调试面板（src/lib/debug-panel.tsx · 场景 Mock tab），
 * 本模块只保留场景注册表与 zustand store；开关持久化到 localStorage。
 */

import { create } from 'zustand';
import { readData, writeEnvelope, StorageKeys } from './storage';
import type { FingerCode } from './types';

/* ── 场景定义（模块开发时在此追加条目即可，面板自动渲染开关） ── */

export interface MockScenarioDef {
  key: string;
  label: string;
  description?: string;
  /** 分组标题 */
  group: string;
}

export const MOCK_SCENARIOS: readonly MockScenarioDef[] = [
  // 渲染（Wizard/Editor 十指预览 7 状态驱动源）
  { key: 'render.failAll', label: '渲染全部失败', description: '预览整体异常/超时 → [刷新]', group: '渲染' },
  { key: 'render.failFinger', label: '单指失败降级', description: '指定指显示灰甲型 + ⚠️，其余 9 指正常', group: '渲染' },
  { key: 'render.timeout', label: '渲染加载超时', description: '预览 > 8s 未完成', group: '渲染' },
  // 保存
  { key: 'save.fail', label: '保存失败', description: '自动重试 3 次 → Toast + [重试保存]', group: '保存' },
  { key: 'save.conflict', label: '并发冲突', description: '「数据已被修改。请刷新后重试。」', group: '保存' },
  // 加载
  { key: 'load.timeout', label: '列表加载超时', description: '10s → 「加载超时」+ [刷新]', group: '加载' },
  { key: 'load.networkFail', label: '网络请求失败', description: '「网络连接失败。请检查网络后重试。」', group: '加载' },
  // 设备（MOCK IOT 十类异常）
  { key: 'device.discoverTimeout', label: '设备发现超时', description: '15s 未发现设备', group: '设备' },
  { key: 'device.wifiWrong', label: 'WiFi 密码错误', description: '重新输入 [重试]', group: '设备' },
  { key: 'device.bindTimeout', label: '设备入网超时', description: '30s 连接超时', group: '设备' },
  { key: 'device.alreadyBound', label: '设备已被绑定', description: '其他门店绑定', group: '设备' },
  { key: 'device.tokenExpired', label: '手机交接 Token 过期', description: '链接已过期', group: '设备' },
  { key: 'device.tokenReused', label: '手机交接 Token 重复使用', description: '此链接已被使用', group: '设备' },
  { key: 'device.reconnectFail', label: '设备重连失败', description: '设备无响应。请检查设备电源和网络', group: '设备' },
  { key: 'device.unbindFail', label: '设备解绑失败', description: '解绑失败：请重试', group: '设备' },
  { key: 'device.concurrentBind', label: '并发绑定同一设备', description: '设备正在被其他操作绑定中', group: '设备' },
  { key: 'device.cloudRegisterFailed', label: '云端注册失败', description: '只重试 hop2，不重跑本地绑定', group: '设备' },
  { key: 'device.snMismatch', label: '序列号不一致', description: '双显期望 SN 与实际 SN', group: '设备' },
  { key: 'device.btPairFailed', label: '蓝牙配对失败', description: 'BIND_BT_PAIR_FAILED', group: '设备' },
  { key: 'device.usbNotFound', label: '未找到 USB 设备', description: 'BIND_USB_NOT_FOUND', group: '设备' },
  { key: 'device.usbDenied', label: 'USB 权限被拒绝', description: 'BIND_USB_DENIED', group: '设备' },
  // 会话
  { key: 'session.expired', label: 'Token 过期强制登出', description: '→ 跳转 /login', group: '会话' },
  // 登录/注册（模块 1 · 基础平台）
  { key: 'auth.sendFail', label: '验证码发送失败', description: 'Toast Error + 冷却 60s', group: '登录' },
  { key: 'auth.codeExpired', label: '验证码立即过期', description: '「验证码已过期，请重新获取。」', group: '登录' },
  // 风险（模块 4 · Editor P0 参数级检查 Mock）
  { key: 'risk.forceIssues', label: 'P0 风险强制告警', description: '风险筛查固定返回 Mock 风险项（超数量 / 超高度 / 边缘邻近）', group: '风险' },
  // Wizard（模块 3 · 模板库加载 / 导出 PNG）
  { key: 'templates.loadFail', label: '模板库加载失败', description: '模板选择器 Toast + [重试]', group: '加载' },
  { key: 'export.fail', label: '导出 PNG 失败', description: 'Toast：「导出失败，请重试。」', group: '导出' },
] as const;

export interface MockScenarioState {
  /** 场景开关：key → on/off */
  flags: Record<string, boolean>;
  /** 单指失败目标指（render.failFinger 的参数） */
  failFinger: FingerCode;
  toggle: (key: string) => void;
  setFailFinger: (finger: FingerCode) => void;
  reset: () => void;
}

const persisted = readData<{ flags: Record<string, boolean>; failFinger: FingerCode }>(
  StorageKeys.mockScenarios,
);

export const useMockScenarios = create<MockScenarioState>((set, get) => ({
  flags: persisted?.flags ?? {},
  failFinger: persisted?.failFinger ?? 'R4',
  toggle: (key) => {
    const flags = { ...get().flags, [key]: !get().flags[key] };
    writeEnvelope(StorageKeys.mockScenarios, { flags, failFinger: get().failFinger });
    set({ flags });
  },
  setFailFinger: (failFinger) => {
    writeEnvelope(StorageKeys.mockScenarios, { flags: get().flags, failFinger });
    set({ failFinger });
  },
  reset: () => {
    writeEnvelope(StorageKeys.mockScenarios, { flags: {}, failFinger: get().failFinger });
    set({ flags: {} });
  },
}));

/** 消费方便捷判断：场景是否开启 */
export function isScenarioOn(flags: Record<string, boolean>, key: string): boolean {
  return flags[key] === true;
}
