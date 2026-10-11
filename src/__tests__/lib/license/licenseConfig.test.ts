import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async (env: Record<string, string>) => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    return import('@/lib/license/licenseConfig');
};

describe('licenseConfig reads the Lemon Squeezy IDs from the environment', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('is not configured when the variables are empty', async () => {
        const config = await load({
            VITE_LEMON_STORE_ID: '',
            VITE_LEMON_PRO_PRODUCT_IDS: '',
            VITE_LEMON_PRO_VARIANT_IDS: '',
            VITE_LEMON_GOD_PRODUCT_IDS: '',
            VITE_LEMON_GOD_VARIANT_IDS: '',
        });
        expect(config.LEMON_STORE_ID).toBe('');
        expect(config.PRO_PRODUCT_IDS).toEqual([]);
        expect(config.isLicenseConfigured()).toBe(false);
    });

    it('splits comma separated lists, trims spaces and drops empty items', async () => {
        const config = await load({
            VITE_LEMON_STORE_ID: ' 123 ',
            VITE_LEMON_PRO_PRODUCT_IDS: '10, 11 ,,',
            VITE_LEMON_PRO_VARIANT_IDS: '20,21,22',
            VITE_LEMON_GOD_PRODUCT_IDS: '',
            VITE_LEMON_GOD_VARIANT_IDS: '30',
            VITE_LEMON_MONTHLY_VARIANT_IDS: '21',
            VITE_LEMON_ANNUAL_VARIANT_IDS: '22',
            VITE_LEMON_LIFETIME_VARIANT_IDS: '20',
        });
        expect(config.LEMON_STORE_ID).toBe('123');
        expect(config.PRO_PRODUCT_IDS).toEqual(['10', '11']);
        expect(config.PRO_VARIANT_IDS).toEqual(['20', '21', '22']);
        expect(config.GOD_VARIANT_IDS).toEqual(['30']);
        expect(config.MONTHLY_VARIANT_IDS).toEqual(['21']);
        expect(config.isLicenseConfigured()).toBe(true);
    });

    it('needs the store AND at least one product or variant that grants a tier', async () => {
        const onlyStore = await load({ VITE_LEMON_STORE_ID: '123', VITE_LEMON_PRO_PRODUCT_IDS: '', VITE_LEMON_PRO_VARIANT_IDS: '', VITE_LEMON_GOD_PRODUCT_IDS: '', VITE_LEMON_GOD_VARIANT_IDS: '' });
        expect(onlyStore.isLicenseConfigured()).toBe(false);

        const onlyProduct = await load({ VITE_LEMON_STORE_ID: '', VITE_LEMON_PRO_PRODUCT_IDS: '10' });
        expect(onlyProduct.isLicenseConfigured()).toBe(false);
    });

    it('keeps the policy numbers: 14 days offline, revalidation every 24 hours', async () => {
        const config = await load({});
        expect(config.OFFLINE_GRACE_DAYS).toBe(14);
        expect(config.REVALIDATE_INTERVAL_HOURS).toBe(24);
    });
});
