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
        });
        expect(config.LEMON_STORE_ID).toBe('123');
        expect(config.PRO_PRODUCT_IDS).toEqual(['10', '11']);
        expect(config.PRO_VARIANT_IDS).toEqual(['20', '21', '22']);
        expect(config.isLicenseConfigured()).toBe(true);
    });

    it('needs the store AND at least one product or variant that grants PRO', async () => {
        const onlyStore = await load({ VITE_LEMON_STORE_ID: '123', VITE_LEMON_PRO_PRODUCT_IDS: '', VITE_LEMON_PRO_VARIANT_IDS: '' });
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
