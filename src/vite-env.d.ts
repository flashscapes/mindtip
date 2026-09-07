/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_PROVIDER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
