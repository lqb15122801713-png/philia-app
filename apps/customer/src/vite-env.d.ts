/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 服务 base（缺省 http://localhost:7200，见 @philia/shared getApiBase） */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
