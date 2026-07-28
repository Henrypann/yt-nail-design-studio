/**
 * 会话（Mock）· 基础平台模块 1
 *
 * session envelope 写入 StorageKeys.session，载荷 { storeName, userName, email }。
 * AppLayout 顶栏只读消费；登出 = 清除 session → /login。
 * 路由守卫以页面级 hook 实现（不改动共享 App.tsx / AppLayout）。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readData, removeKey, writeEnvelope, StorageKeys } from '@/lib/storage';
import { Routes } from '@/app/routes';

export interface SessionInfo {
  storeName: string;
  userName: string;
  email: string;
}

export function getSession(): SessionInfo | null {
  const data = readData<SessionInfo>(StorageKeys.session);
  if (!data || typeof data.email !== 'string') return null;
  return data;
}

export function writeSession(session: SessionInfo): void {
  writeEnvelope(StorageKeys.session, session);
}

export function clearSession(): void {
  removeKey(StorageKeys.session);
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

/**
 * 登录后页面守卫：无 session → 跳转 /login（PRD §3.3：登出后浏览器后退被拦截）。
 * 返回当前 session；未登录时返回 null 并触发跳转。
 */
export function useRequireAuth(): SessionInfo | null {
  const navigate = useNavigate();
  const [session] = useState<SessionInfo | null>(() => getSession());

  useEffect(() => {
    if (!session) navigate(Routes.login, { replace: true });
  }, [session, navigate]);

  return session;
}
