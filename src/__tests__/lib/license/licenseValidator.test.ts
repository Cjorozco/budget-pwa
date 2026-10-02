import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/license/licenseConfig', () => ({
    LEMON_STORE_ID: '111',
    PRO_PRODUCT_IDS: ['200'],
    PRO_VARIANT_IDS: ['300', '301', '302'],
    GOD_PRODUCT_IDS: ['900'],
    GOD_VARIANT_IDS: ['999'],
    MONTHLY_VARIANT_IDS: ['301'],
    ANNUAL_VARIANT_IDS: ['302'],
    LIFETIME_VARIANT_IDS: ['300'],
    OFFLINE_GRACE_DAYS: 14,
    REVALIDATE_INTERVAL_HOURS: 24,
}));

import {
    activateLicenseKey,
    revalidateLicenseKey,
    isLemonKeyFormat,
    NEEDS_INTERNET_MESSAGE,
} from '@/lib/license/licenseValidator';

const UUID = 'c45c6116-d975-43d9-9995-cc8811d926f7';

const lemonResponse = (over: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) => ({
    activated: true,
    valid: true,
    error: null,
    license_key: { status: 'active', expires_at: null },
    instance: { id: 'inst-1' },
    meta: { store_id: 111, product_id: 200, variant_id: 300, variant_name: 'Lifetime', customer_email: 'a@b.co', ...meta },
    ...over,
});

const mockFetchJson = (body: unknown, status = 200) =>
    vi.fn().mockResolvedValue({ status, json: async () => body });

describe('licenseValidator', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetchJson(lemonResponse()));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('rejects old master keys and signed PB keys without calling the network', async () => {
        const keys = ['VIP-GOD-ORZIX', 'PBGOD-ORZIX-FOUNDER-98274198', 'PBGOD-CREATOR-VIP-77319420', 'PBLIF-FRIEND-9F2B8A1C', 'god', '1234567890'];
        for (const key of keys) {
            const r = await activateLicenseKey(key);
            expect(r.valid).toBe(false);
        }
        expect(fetch).not.toHaveBeenCalled();
    });

    it('does not treat a UUID-shaped string as a license when offline', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
        const r = await activateLicenseKey(UUID);
        expect(r.valid).toBe(false);
        expect(r.reason).toBe('network');
        expect(r.error).toBe(NEEDS_INTERNET_MESSAGE);
    });

    it('activates a license from our store and product as PRO lifetime', async () => {
        const r = await activateLicenseKey(UUID);
        expect(r).toMatchObject({ valid: true, tier: 'pro', planType: 'lifetime', expiresAt: null, instanceId: 'inst-1' });
        const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/activate');
        expect(String(init.body)).toContain(`license_key=${UUID}`);
    });

    it('rejects a license from another store', async () => {
        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({}, { store_id: 222 })));
        const r = await activateLicenseKey(UUID);
        expect(r.valid).toBe(false);
        expect(r.reason).toBe('invalid');
    });

    it('rejects a product/variant that is not allowed', async () => {
        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({}, { product_id: 555, variant_id: 556 })));
        expect((await activateLicenseKey(UUID)).valid).toBe(false);
    });

    it('rejects when activated is not true', async () => {
        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({ activated: false, error: 'license_key not found.' }), 404));
        const r = await activateLicenseKey(UUID);
        expect(r.valid).toBe(false);
        expect(r.error).toContain('no encontrada');
    });

    it('maps the GOD variant to GOD and ignores the word "god" in names', async () => {
        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({}, { variant_id: 999 })));
        expect((await activateLicenseKey(UUID)).tier).toBe('god');

        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({}, { variant_name: 'God mode', product_name: 'GOD' })));
        expect((await activateLicenseKey(UUID)).tier).toBe('pro');
    });

    it('maps a monthly variant with expires_at to monthly + exact expiration', async () => {
        const expires = '2099-01-15T00:00:00.000Z';
        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({ license_key: { status: 'active', expires_at: expires } }, { variant_id: 301 })));
        const r = await activateLicenseKey(UUID);
        expect(r.planType).toBe('monthly');
        expect(r.expiresAt).toBe(new Date(expires).getTime());
    });

    it('rejects expired or disabled licenses', async () => {
        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({ license_key: { status: 'expired', expires_at: null } })));
        expect((await activateLicenseKey(UUID)).reason).toBe('expired');
        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({ license_key: { status: 'disabled', expires_at: null } })));
        expect((await activateLicenseKey(UUID)).valid).toBe(false);
    });

    it('revalidates with license_key + instance_id and applies the same store/product checks', async () => {
        const ok = await revalidateLicenseKey(UUID, 'inst-1');
        expect(ok.valid).toBe(true);
        const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/validate');
        expect(String(init.body)).toContain('instance_id=inst-1');

        vi.stubGlobal('fetch', mockFetchJson(lemonResponse({}, { store_id: 222 })));
        expect((await revalidateLicenseKey(UUID, 'inst-1')).valid).toBe(false);
    });

    it('reports network errors and 5xx as reason "network" on revalidation', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
        expect((await revalidateLicenseKey(UUID, 'i')).reason).toBe('network');
        vi.stubGlobal('fetch', mockFetchJson({}, 503));
        expect((await revalidateLicenseKey(UUID, 'i')).reason).toBe('network');
    });

    it('detects Lemon key format without implying validity', () => {
        expect(isLemonKeyFormat(UUID)).toBe(true);
        expect(isLemonKeyFormat('VIP-GOD-ORZIX')).toBe(false);
        expect(isLemonKeyFormat(null)).toBe(false);
    });
});
