import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

const UUID = 'c45c6116-d975-43d9-9995-cc8811d926f7';
const STORAGE_KEY = 'personal_budget_license';
const REMOVED_FLAG = ['budget', 'is', 'pro'].join('_');
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-01T12:00:00Z').getTime();

const lemonOk = (over: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) => ({
    activated: true,
    valid: true,
    error: null,
    license_key: { status: 'active', expires_at: null },
    instance: { id: 'inst-1' },
    meta: { store_id: 111, product_id: 200, variant_id: 300, ...meta },
    ...over,
});

const respond = (body: unknown, status = 200) => vi.fn().mockResolvedValue({ status, json: async () => body });
const offline = () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

const seedLicense = (over: Record<string, unknown> = {}) =>
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            tier: 'pro',
            planType: 'lifetime',
            licenseKey: UUID,
            activatedAt: NOW - DAY,
            expiresAt: null,
            instanceId: 'inst-1',
            lastValidatedAt: NOW - DAY,
            ...over,
        }),
    );

/** Fresh module graph so getInitialState reads whatever localStorage holds right now. */
async function loadStore() {
    vi.resetModules();
    const license = await import('@/store/licenseStore');
    const ui = await import('@/store/ui');
    return { ...license, ui: ui.useUIStore };
}

const toasts = (ui: Awaited<ReturnType<typeof loadStore>>['ui']) => ui.getState().toasts.map((t) => t.message);

describe('licenseStore', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        vi.stubGlobal('fetch', offline());
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('initializes in free tier by default', async () => {
        const { useLicenseStore } = await loadStore();
        const state = useLicenseStore.getState();
        expect(state.tier).toBe('free');
        expect(state.isPro).toBe(false);
        expect(state.isGod).toBe(false);
        expect(state.canCreateAccount(1)).toBe(true);
        expect(state.canCreateAccount(2)).toBe(false);
        expect(state.canCreateReserve(0)).toBe(true);
        expect(state.canCreateReserve(1)).toBe(false);
        expect(state.canCreateTemplate(1)).toBe(true);
        expect(state.canCreateTemplate(2)).toBe(false);
        expect(state.canExportCsv()).toBe(false);
        expect(state.canUseAi()).toBe(false);
    });

    describe('activation', () => {
        it('activates PRO with a license from our store and stores instanceId + lastValidatedAt', async () => {
            vi.stubGlobal('fetch', respond(lemonOk()));
            const { useLicenseStore } = await loadStore();
            const result = await useLicenseStore.getState().activateLicense(UUID);
            expect(result.success).toBe(true);

            const state = useLicenseStore.getState();
            expect(state.tier).toBe('pro');
            expect(state.isPro).toBe(true);
            expect(state.isGod).toBe(false);
            expect(state.instanceId).toBe('inst-1');
            expect(state.lastValidatedAt).toBe(NOW);
            expect(state.canCreateAccount(10)).toBe(true);
            expect(state.canUseAi()).toBe(true);
            expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).instanceId).toBe('inst-1');
        });

        it('activates GOD with the GOD variant', async () => {
            vi.stubGlobal('fetch', respond(lemonOk({}, { variant_id: 999 })));
            const { useLicenseStore } = await loadStore();
            await useLicenseStore.getState().activateLicense(UUID);
            expect(useLicenseStore.getState().tier).toBe('god');
            expect(useLicenseStore.getState().isGod).toBe(true);
        });

        it('stores monthly plan with the expiration returned by Lemon', async () => {
            const expires = new Date(NOW + 20 * DAY).toISOString();
            vi.stubGlobal('fetch', respond(lemonOk({ license_key: { status: 'active', expires_at: expires } }, { variant_id: 301 })));
            const { useLicenseStore } = await loadStore();
            await useLicenseStore.getState().activateLicense(UUID);
            expect(useLicenseStore.getState().planType).toBe('monthly');
            expect(useLicenseStore.getState().expiresAt).toBe(NOW + 20 * DAY);
        });

        it('fails clearly without internet and never grants a tier', async () => {
            const { useLicenseStore } = await loadStore();
            const result = await useLicenseStore.getState().activateLicense(UUID);
            expect(result.success).toBe(false);
            expect(result.message).toBe('Necesitas internet para activar tu licencia.');
            expect(useLicenseStore.getState().isPro).toBe(false);
        });

        it('rejects old master, signed and random keys', async () => {
            const { useLicenseStore } = await loadStore();
            for (const key of ['VIP-GOD-ORZIX', 'PBGOD-ORZIX-FOUNDER-98274198', 'PBLIF-FRIEND-9F2B8A1C', '1234', 'MY-GOD-KEY']) {
                const result = await useLicenseStore.getState().activateLicense(key);
                expect(result.success).toBe(false);
            }
            expect(useLicenseStore.getState().isPro).toBe(false);
        });

        it('rejects a license from another store', async () => {
            vi.stubGlobal('fetch', respond(lemonOk({}, { store_id: 222 })));
            const { useLicenseStore } = await loadStore();
            expect((await useLicenseStore.getState().activateLicense(UUID)).success).toBe(false);
            expect(useLicenseStore.getState().isPro).toBe(false);
        });

        it('rejects a product that is not allowed', async () => {
            vi.stubGlobal('fetch', respond(lemonOk({}, { product_id: 555, variant_id: 556 })));
            const { useLicenseStore } = await loadStore();
            expect((await useLicenseStore.getState().activateLicense(UUID)).success).toBe(false);
        });
    });

    describe('deactivation', () => {
        it('calls /deactivate with the instance id and always clears local state', async () => {
            seedLicense();
            const fetchMock = respond({ deactivated: true });
            vi.stubGlobal('fetch', fetchMock);
            const { useLicenseStore } = await loadStore();
            useLicenseStore.getState().deactivateLicense();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).toBe('https://api.lemonsqueezy.com/v1/licenses/deactivate');
            expect(String(fetchMock.mock.calls[0][1].body)).toContain('instance_id=inst-1');
            expect(useLicenseStore.getState().isPro).toBe(false);
            expect(useLicenseStore.getState().licenseKey).toBeNull();
        });

        it('clears local state even when the remote call fails', async () => {
            seedLicense();
            const { useLicenseStore } = await loadStore();
            useLicenseStore.getState().deactivateLicense();
            await Promise.resolve();
            expect(useLicenseStore.getState().tier).toBe('free');
            expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).licenseKey).toBeNull();
        });
    });

    describe('legacy flag and migration', () => {
        it('ignores the removed pro flag without a license, and deletes it', async () => {
            localStorage.setItem(REMOVED_FLAG, 'true');
            const { useLicenseStore } = await loadStore();
            expect(useLicenseStore.getState().tier).toBe('free');
            expect(useLicenseStore.getState().isPro).toBe(false);
            expect(localStorage.getItem(REMOVED_FLAG)).toBeNull();
        });

        it('does not write the removed flag when saving state', async () => {
            vi.stubGlobal('fetch', respond(lemonOk()));
            const { useLicenseStore } = await loadStore();
            await useLicenseStore.getState().activateLicense(UUID);
            expect(localStorage.getItem(REMOVED_FLAG)).toBeNull();
        });

        it('downgrades a stored VIP-GOD-ORZIX to free with a single toast', async () => {
            seedLicense({ tier: 'god', licenseKey: 'VIP-GOD-ORZIX', instanceId: null, lastValidatedAt: null });
            const first = await loadStore();
            expect(first.useLicenseStore.getState().tier).toBe('free');
            expect(first.useLicenseStore.getState().isGod).toBe(false);
            first.startLicenseLifecycle();
            expect(toasts(first.ui)).toHaveLength(1);
            expect(toasts(first.ui)[0]).toContain('Reactívala con la clave de tu compra');

            // Second launch: state was persisted as free, no more notices.
            const second = await loadStore();
            second.startLicenseLifecycle();
            expect(toasts(second.ui)).toHaveLength(0);
        });

        it.each(['PBGOD-ORZIX-FOUNDER-98274198', 'LEGACY-PRO', 'PBMON-CLIENT01-ABCDEF12'])('downgrades stored %s to free', async (key) => {
            seedLicense({ licenseKey: key });
            const { useLicenseStore } = await loadStore();
            expect(useLicenseStore.getState().isPro).toBe(false);
            expect(useLicenseStore.getState().licenseKey).toBeNull();
        });

        it('keeps a stored UUID license without instanceId/lastValidatedAt and starts the grace from now', async () => {
            seedLicense({ instanceId: null, lastValidatedAt: null });
            const { useLicenseStore } = await loadStore();
            expect(useLicenseStore.getState().isPro).toBe(true);
            expect(useLicenseStore.getState().lastValidatedAt).toBe(NOW);
        });
    });

    describe('revalidation', () => {
        it('updates lastValidatedAt and expiration when Lemon says valid', async () => {
            seedLicense({ planType: 'monthly', lastValidatedAt: NOW - 2 * DAY, expiresAt: NOW + 3 * DAY });
            const newExpiry = new Date(NOW + 30 * DAY).toISOString();
            vi.stubGlobal('fetch', respond(lemonOk({ license_key: { status: 'active', expires_at: newExpiry } }, { variant_id: 301 })));
            const { useLicenseStore } = await loadStore();
            await useLicenseStore.getState().revalidateLicense();
            expect(useLicenseStore.getState().isPro).toBe(true);
            expect(useLicenseStore.getState().lastValidatedAt).toBe(NOW);
            expect(useLicenseStore.getState().expiresAt).toBe(NOW + 30 * DAY);
        });

        it('drops to free with a toast when Lemon says invalid', async () => {
            seedLicense({ lastValidatedAt: NOW - 2 * DAY });
            vi.stubGlobal('fetch', respond({ valid: false, error: 'license_key has been disabled.', meta: null }, 400));
            const { useLicenseStore, ui } = await loadStore();
            await useLicenseStore.getState().revalidateLicense();
            expect(useLicenseStore.getState().tier).toBe('free');
            expect(useLicenseStore.getState().licenseKey).toBeNull();
            expect(toasts(ui)[0]).toContain('ya no es válida');
        });

        it('drops to free when the license belongs to another store', async () => {
            seedLicense({ lastValidatedAt: NOW - 2 * DAY });
            vi.stubGlobal('fetch', respond(lemonOk({}, { store_id: 222 })));
            const { useLicenseStore } = await loadStore();
            await useLicenseStore.getState().revalidateLicense();
            expect(useLicenseStore.getState().isPro).toBe(false);
        });

        it('changes nothing on a network error', async () => {
            seedLicense({ lastValidatedAt: NOW - 2 * DAY });
            const { useLicenseStore, ui } = await loadStore();
            await useLicenseStore.getState().revalidateLicense();
            expect(useLicenseStore.getState().isPro).toBe(true);
            expect(useLicenseStore.getState().lastValidatedAt).toBe(NOW - 2 * DAY);
            expect(toasts(ui)).toHaveLength(0);
        });

        it('is throttled to once every 24h unless forced', async () => {
            seedLicense({ lastValidatedAt: NOW - 2 * 60 * 60 * 1000 });
            const fetchMock = respond(lemonOk());
            vi.stubGlobal('fetch', fetchMock);
            const { useLicenseStore } = await loadStore();
            await useLicenseStore.getState().revalidateLicense();
            expect(fetchMock).not.toHaveBeenCalled();
            await useLicenseStore.getState().revalidateLicense({ force: true });
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('offline grace period', () => {
        it('stays PRO when last validated 13 days ago', async () => {
            seedLicense({ lastValidatedAt: NOW - 13 * DAY });
            const { useLicenseStore } = await loadStore();
            expect(useLicenseStore.getState().isPro).toBe(true);
        });

        it('falls to free with a toast when last validated 15 days ago', async () => {
            seedLicense({ lastValidatedAt: NOW - 15 * DAY });
            const { useLicenseStore, startLicenseLifecycle, ui } = await loadStore();
            expect(useLicenseStore.getState().isPro).toBe(false);
            startLicenseLifecycle();
            expect(toasts(ui)).toContain('Conéctate a internet para verificar tu licencia.');
        });

        it('restores the tier when the network returns and the license is still valid', async () => {
            seedLicense({ lastValidatedAt: NOW - 15 * DAY });
            const { useLicenseStore } = await loadStore();
            expect(useLicenseStore.getState().isPro).toBe(false);
            expect(useLicenseStore.getState().licenseKey).toBe(UUID);

            vi.stubGlobal('fetch', respond(lemonOk()));
            await useLicenseStore.getState().revalidateLicense();
            expect(useLicenseStore.getState().tier).toBe('pro');
            expect(useLicenseStore.getState().lastValidatedAt).toBe(NOW);
        });

        it('does not restore when the license is no longer valid', async () => {
            seedLicense({ lastValidatedAt: NOW - 15 * DAY });
            const { useLicenseStore } = await loadStore();
            vi.stubGlobal('fetch', respond({ valid: false, error: 'license_key not found.' }, 404));
            await useLicenseStore.getState().revalidateLicense();
            expect(useLicenseStore.getState().isPro).toBe(false);
            expect(useLicenseStore.getState().licenseKey).toBeNull();
        });

        it('drops an expired monthly plan even inside the grace window', async () => {
            seedLicense({ planType: 'monthly', expiresAt: NOW - DAY, lastValidatedAt: NOW - 2 * DAY });
            const { useLicenseStore } = await loadStore();
            expect(useLicenseStore.getState().isPro).toBe(false);
        });
    });

    it('formats tier display names', async () => {
        const { getTierDisplayName } = await loadStore();
        expect(getTierDisplayName('free')).toBe('Plan Básico (Free)');
        expect(getTierDisplayName('pro')).toBe('Personal Budget PRO');
        expect(getTierDisplayName('god')).toBe('Personal Budget GOD');
    });

    it('opens and closes upgrade modal with reason', async () => {
        const { useLicenseStore } = await loadStore();
        useLicenseStore.getState().openUpgradeModal('Prueba modal');
        expect(useLicenseStore.getState().isUpgradeModalOpen).toBe(true);
        expect(useLicenseStore.getState().upgradeModalReason).toBe('Prueba modal');

        useLicenseStore.getState().closeUpgradeModal();
        expect(useLicenseStore.getState().isUpgradeModalOpen).toBe(false);
        expect(useLicenseStore.getState().upgradeModalReason).toBeUndefined();
    });
});
