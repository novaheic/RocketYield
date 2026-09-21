/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ETHEREUM_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
