/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EDITOR_V7?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
