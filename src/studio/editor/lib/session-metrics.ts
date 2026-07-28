/**
 * Editor 手绘会话轻量埋点（Day 5 验证用）
 * 写入 localStorage，供 Go/No-Go 分析。
 */

const STORAGE_KEY = 'editor.handdraw.session';

export interface HandDrawSessionMetrics {
  startedAt: string;
  strokeCount: number;
  undoCount: number;
  mirrorUsed: boolean;
  mirrorCount: number;
  completedAt?: string;
}

function read(): HandDrawSessionMetrics {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as HandDrawSessionMetrics;
  } catch {
    /* ignore */
  }
  return {
    startedAt: new Date().toISOString(),
    strokeCount: 0,
    undoCount: 0,
    mirrorUsed: false,
    mirrorCount: 0,
  };
}

function write(m: HandDrawSessionMetrics): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
}

export function ensureSession(): HandDrawSessionMetrics {
  const m = read();
  write(m);
  return m;
}

export function recordStroke(): void {
  const m = read();
  m.strokeCount += 1;
  write(m);
}

export function recordUndo(): void {
  const m = read();
  m.undoCount += 1;
  write(m);
}

export function recordMirror(): void {
  const m = read();
  m.mirrorUsed = true;
  m.mirrorCount += 1;
  write(m);
}

export function markSessionComplete(): void {
  const m = read();
  m.completedAt = new Date().toISOString();
  write(m);
}

export function getSessionMetrics(): HandDrawSessionMetrics {
  return read();
}

export function resetSessionMetrics(): void {
  localStorage.removeItem(STORAGE_KEY);
}
