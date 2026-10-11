/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_LEMON_CHECKOUT_URL: string
  /** Lemon Squeezy store id and the products / variants that grant each tier (comma separated). Not secrets. */
  readonly VITE_LEMON_STORE_ID?: string
  readonly VITE_LEMON_PRO_PRODUCT_IDS?: string
  readonly VITE_LEMON_PRO_VARIANT_IDS?: string
  readonly VITE_LEMON_GOD_PRODUCT_IDS?: string
  readonly VITE_LEMON_GOD_VARIANT_IDS?: string
  readonly VITE_LEMON_MONTHLY_VARIANT_IDS?: string
  readonly VITE_LEMON_ANNUAL_VARIANT_IDS?: string
  readonly VITE_LEMON_LIFETIME_VARIANT_IDS?: string
}
