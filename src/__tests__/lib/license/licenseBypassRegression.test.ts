import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/license/licenseConfig', () => ({
    LEMON_STORE_ID: '111',
    PRO_PRODUCT_IDS: ['200'],
    PRO_VARIANT_IDS: ['300'],
    GOD_PRODUCT_IDS: ['900'],
    GOD_VARIANT_IDS: ['999'],
    MONTHLY_VARIANT_IDS: [],
    ANNUAL_VARIANT_IDS: [],
    LIFETIME_VARIANT_IDS: ['300'],
    OFFLINE_GRACE_DAYS: 14,
    REVALIDATE_INTERVAL_HOURS: 24,
    isLicenseConfigured: () => true,
}));

import * as validator from '@/lib/license/licenseValidator';
import { activateLicenseKey } from '@/lib/license/licenseValidator';

const randomUuid = () => crypto.randomUUID();

/**
 * Each case below was a real way to get PRO or GOD for free in v2.2.0 (verified by running the
 * old validator). They must stay impossible.
 */
describe('license bypasses that used to work (regression)', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    });

    afterEach(() => vi.restoreAllMocks());

    it('1-2. no offline key format exists any more: no master keys, no signed-key generator or checker', async () => {
        expect(validator).not.toHaveProperty('generateSignedLicense');
        expect(validator).not.toHaveProperty('validateLicenseKey');
        expect(validator).not.toHaveProperty('validateLicenseKeyAsync');

        for (const key of ['PBGOD-ORZIX-FOUNDER-98274198', 'PBGOD-CREATOR-VIP-77319420', 'VIP-GOD-ORZIX', 'PBGOD-FAMILIA-DEADBEEF']) {
            const result = await activateLicenseKey(key);
            expect(result.valid, key).toBe(false);
        }
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('3. a random UUID without internet is not a license', async () => {
        const result = await activateLicenseKey(randomUuid());
        expect(result).toMatchObject({ valid: false, reason: 'network' });
        expect(result.tier).toBeUndefined();
    });

    it('4. a random UUID with internet is not a license when Lemon answers with something unusable', async () => {
        for (const body of ['<html>blocked</html>', '', 'null', '[]']) {
            fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));
            const result = await activateLicenseKey(randomUuid());
            expect(result.valid, `body: ${body}`).toBe(false);
        }
        fetchSpy.mockResolvedValue(new Response('server error', { status: 502 }));
        expect((await activateLicenseKey(randomUuid())).valid).toBe(false);
    });

    it('5. a real license from someone else\'s Lemon Squeezy store is not accepted, even if its product says "god"', async () => {
        fetchSpy.mockResolvedValue(
            new Response(
                JSON.stringify({
                    activated: true,
                    license_key: { status: 'active', expires_at: null },
                    instance: { id: 'i-1' },
                    meta: { store_id: 999999, product_id: 5, variant_id: 6, product_name: 'My free product god', variant_name: 'god', customer_email: 'x@y.z' },
                }),
                { status: 200 }
            )
        );
        const result = await activateLicenseKey(randomUuid());
        expect(result.valid).toBe(false);
        expect(result.tier).toBeUndefined();
    });

    it('5b. our store but a product that does not grant any tier is not accepted either', async () => {
        fetchSpy.mockResolvedValue(
            new Response(
                JSON.stringify({
                    activated: true,
                    license_key: { status: 'active', expires_at: null },
                    instance: { id: 'i-1' },
                    meta: { store_id: 111, product_id: 777, variant_id: 888, product_name: 'Some other product', variant_name: 'god' },
                }),
                { status: 200 }
            )
        );
        expect((await activateLicenseKey(randomUuid())).valid).toBe(false);
    });
});
