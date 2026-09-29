import { describe, it, expect, beforeEach } from 'vitest';
import { useLicenseStore, getTierDisplayName } from '@/store/licenseStore';

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

    it('activates PRO tier with a valid PRO license key', () => {
        const result = useLicenseStore.getState().activateLicense('PRO-ABCD-1234');
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

    it('activates GOD tier with a GOD license key', () => {
        const result = useLicenseStore.getState().activateLicense('GOD-ULTIMATE-KEY');
        expect(result.success).toBe(true);

        const state = useLicenseStore.getState();
        expect(state.tier).toBe('god');
        expect(state.isPro).toBe(true);
        expect(state.isGod).toBe(true);
    });

    it('rejects invalid or too short license keys', () => {
        const result = useLicenseStore.getState().activateLicense('1234');
        expect(result.success).toBe(false);
        expect(useLicenseStore.getState().isPro).toBe(false);
    });

    it('deactivates license back to free', () => {
        useLicenseStore.getState().activateLicense('PRO-TEST-KEY-12345');
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
