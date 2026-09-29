import { describe, it, expect, beforeEach } from 'vitest';
import { useLicenseStore, getTierDisplayName } from '@/store/licenseStore';
import { generateSignedLicense } from '@/lib/license/licenseValidator';

describe('licenseStore', () => {
    beforeEach(() => {
        localStorage.clear();
        useLicenseStore.getState().deactivateLicense();
    });

    it('initializes in free tier by default', () => {
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
    });

    it('activates PRO tier with a valid signed PRO license key', async () => {
        const proKey = generateSignedLicense('pro', 'lifetime', 'TESTUSER');
        const result = await useLicenseStore.getState().activateLicense(proKey);
        expect(result.success).toBe(true);

        const state = useLicenseStore.getState();
        expect(state.tier).toBe('pro');
        expect(state.isPro).toBe(true);
        expect(state.isGod).toBe(false);
        expect(state.canCreateAccount(10)).toBe(true);
        expect(state.canCreateReserve(10)).toBe(true);
        expect(state.canCreateTemplate(10)).toBe(true);
        expect(state.canExportCsv()).toBe(true);
    });

    it('activates GOD tier with an authentic founder GOD license key', async () => {
        const result = await useLicenseStore.getState().activateLicense('VIP-GOD-ORZIX');
        expect(result.success).toBe(true);

        const state = useLicenseStore.getState();
        expect(state.tier).toBe('god');
        expect(state.isPro).toBe(true);
        expect(state.isGod).toBe(true);
    });

    it('rejects invalid or too short license keys', async () => {
        const result = await useLicenseStore.getState().activateLicense('1234');
        expect(result.success).toBe(false);
        expect(useLicenseStore.getState().isPro).toBe(false);
    });

    it('rejects guessable random words', async () => {
        const result = await useLicenseStore.getState().activateLicense('MY-GOD-KEY');
        expect(result.success).toBe(false);
        expect(useLicenseStore.getState().isPro).toBe(false);
    });

    it('deactivates license back to free', async () => {
        const proKey = generateSignedLicense('pro', 'lifetime', 'TESTUSER');
        await useLicenseStore.getState().activateLicense(proKey);
        expect(useLicenseStore.getState().isPro).toBe(true);

        useLicenseStore.getState().deactivateLicense();
        expect(useLicenseStore.getState().isPro).toBe(false);
        expect(useLicenseStore.getState().tier).toBe('free');
    });

    it('formats tier display names', () => {
        expect(getTierDisplayName('free')).toBe('Plan Básico (Free)');
        expect(getTierDisplayName('pro')).toBe('Personal Budget PRO');
        expect(getTierDisplayName('god')).toBe('Personal Budget GOD');
    });

    it('opens and closes upgrade modal with reason', () => {
        useLicenseStore.getState().openUpgradeModal('Prueba modal');
        expect(useLicenseStore.getState().isUpgradeModalOpen).toBe(true);
        expect(useLicenseStore.getState().upgradeModalReason).toBe('Prueba modal');

        useLicenseStore.getState().closeUpgradeModal();
        expect(useLicenseStore.getState().isUpgradeModalOpen).toBe(false);
        expect(useLicenseStore.getState().upgradeModalReason).toBeUndefined();
    });
});
