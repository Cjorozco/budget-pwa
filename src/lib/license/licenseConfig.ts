/**
 * Lemon Squeezy licensing configuration.
 *
 * The IDs are not secrets (Lemon Squeezy returns them to anyone who activates a license) and live
 * in `.env` as `VITE_LEMON_*` variables, next to the checkout URL. Lists are comma separated and
 * compared as strings, because the API returns numbers.
 *
 * There is a single paid tier (PRO), unlocked by a one-time "buy me a coffee" purchase.
 * Anything left empty means "not configured": no license can match, so activation fails closed
 * instead of accepting licenses from other stores. `isLicenseConfigured()` tells the UI.
 */

const env = import.meta.env as Record<string, string | undefined>;

const single = (value: string | undefined): string => (value ?? '').trim();

const list = (value: string | undefined): readonly string[] =>
    (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

export const LEMON_STORE_ID = single(env.VITE_LEMON_STORE_ID);

// Products / variants that grant PRO.
export const PRO_PRODUCT_IDS: readonly string[] = list(env.VITE_LEMON_PRO_PRODUCT_IDS);
export const PRO_VARIANT_IDS: readonly string[] = list(env.VITE_LEMON_PRO_VARIANT_IDS);

/** Days a license keeps working without a successful online validation. */
export const OFFLINE_GRACE_DAYS = 14;

/** Minimum time between background revalidations. */
export const REVALIDATE_INTERVAL_HOURS = 24;

/** True when the store and at least one product or variant that grants PRO are configured. */
export function isLicenseConfigured(): boolean {
    const grantsPro = PRO_PRODUCT_IDS.length > 0 || PRO_VARIANT_IDS.length > 0;
    return LEMON_STORE_ID !== '' && grantsPro;
}
