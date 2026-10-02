/**
 * Lemon Squeezy licensing configuration.
 *
 * Fill the `TODO_FILL` placeholders with the real IDs from the Lemon Squeezy dashboard.
 * While they are placeholders no license can match, so activation fails closed.
 * IDs are compared as strings (the API returns numbers).
 */

export const LEMON_STORE_ID = 'TODO_FILL';

// Products / variants that grant PRO.
export const PRO_PRODUCT_IDS: readonly string[] = ['TODO_FILL'];
export const PRO_VARIANT_IDS: readonly string[] = ['TODO_FILL'];

// Products / variants that grant GOD.
export const GOD_PRODUCT_IDS: readonly string[] = ['TODO_FILL'];
export const GOD_VARIANT_IDS: readonly string[] = ['TODO_FILL'];

// Variant -> billing plan. Variants not listed fall back to expires_at / name heuristics.
export const MONTHLY_VARIANT_IDS: readonly string[] = ['TODO_FILL'];
export const ANNUAL_VARIANT_IDS: readonly string[] = ['TODO_FILL'];
export const LIFETIME_VARIANT_IDS: readonly string[] = ['TODO_FILL'];

/** Days a license keeps working without a successful online validation. */
export const OFFLINE_GRACE_DAYS = 14;

/** Minimum time between background revalidations. */
export const REVALIDATE_INTERVAL_HOURS = 24;
