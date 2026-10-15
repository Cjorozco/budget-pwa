import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/license/licenseConfig', () => ({
    LEMON_STORE_ID: '',
    PRO_PRODUCT_IDS: [],
    PRO_VARIANT_IDS: [],
    OFFLINE_GRACE_DAYS: 14,
    REVALIDATE_INTERVAL_HOURS: 24,
    isLicenseConfigured: () => false,
}));

import { NOT_CONFIGURED_MESSAGE, activateLicenseKey, revalidateLicenseKey } from '@/lib/license/licenseValidator';

const UUID = 'c45c6116-d975-43d9-9995-cc8811d926f7';

describe('a build without the Lemon Squeezy IDs fails closed', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });
    afterEach(() => vi.restoreAllMocks());

    it('refuses to activate anything, without even calling Lemon Squeezy', async () => {
        const result = await activateLicenseKey(UUID);
        expect(result).toMatchObject({ valid: false, error: NOT_CONFIGURED_MESSAGE });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not accept a license even when the answer has an empty store id', async () => {
        fetchSpy.mockResolvedValue(
            new Response(JSON.stringify({ valid: true, license_key: { status: 'active' }, meta: { store_id: '', product_id: '', variant_id: '' } }), { status: 200 })
        );
        // revalidation is the path that would otherwise compare '' with ''
        const result = await revalidateLicenseKey(UUID, 'inst-1');
        expect(result.valid).toBe(false);
    });

    it('revalidation gives no verdict (so paying customers are not logged out by a misconfigured deploy)', async () => {
        const result = await revalidateLicenseKey(UUID, 'inst-1');
        expect(result).toMatchObject({ valid: false, reason: 'network' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
