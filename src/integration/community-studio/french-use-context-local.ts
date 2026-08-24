import {
  createFrenchUseContextPortV1,
  type FrenchUseContextStorageV1,
} from './french-use-context-v1';

const STORAGE_KEY = 'nail-studio:int-french-use-context-v1';

const storage: FrenchUseContextStorageV1 = {
  read() {
    if (typeof window === 'undefined') return {};
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid French use context store');
    return structuredClone(parsed) as Record<string, unknown>;
  },
  write(next) {
    if (typeof window === 'undefined') throw new Error('session storage unavailable');
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
};

export const frenchUseContextPortV1 = createFrenchUseContextPortV1(storage, () => Date.now());
