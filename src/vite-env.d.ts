/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Checkout link for the voluntary "buy me a coffee" contribution. Empty hides the section. */
  readonly VITE_LEMON_CHECKOUT_URL?: string
}
