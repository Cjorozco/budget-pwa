import { create } from 'zustand';

export type Tier = 'free' | 'pro' | 'god';
export type PlanType = 'monthly' | 'annual' | 'lifetime';
export type ThemeMode = 'classic' | 'dbz';

export interface StoredLicense {
    tier: Tier;
    planType: PlanType | null;
    licenseKey: string | null;
    activatedAt: number | null;
    expiresAt: number | null;
    themeMode: ThemeMode;
}

export const FREE_LIMITS = {
    maxAccounts: 2,
    maxReserves: 1,
    maxTemplates: 2,
    maxTags: 3,
} as const;

interface LicenseState extends StoredLicense {
    isPro: boolean;
    isGod: boolean;
    isUpgradeModalOpen: boolean;
    upgradeModalReason?: string;
    
    // Actions
    activateLicense: (key: string) => { success: boolean; message: string; tier?: Tier };
    deactivateLicense: () => void;
    setThemeMode: (mode: ThemeMode) => void;
    openUpgradeModal: (reason?: string) => void;
    closeUpgradeModal: () => void;
    
    // Feature checks
    canCreateAccount: (currentCount: number) => boolean;
    canCreateReserve: (currentCount: number) => boolean;
    canCreateTemplate: (currentCount: number) => boolean;
    canUseAi: () => boolean;
    canExportCsv: () => boolean;
}

const STORAGE_KEY = 'personal_budget_license';
const LEGACY_KEY = 'budget_is_pro';

const getInitialState = (): StoredLicense => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                tier: parsed.tier || 'free',
                planType: parsed.planType || null,
                licenseKey: parsed.licenseKey || null,
                activatedAt: parsed.activatedAt || null,
                expiresAt: parsed.expiresAt || null,
                themeMode: parsed.themeMode || 'classic',
            };
        }
        
        // Fallback for legacy key
        const legacyPro = localStorage.getItem(LEGACY_KEY) === 'true';
        if (legacyPro) {
            return {
                tier: 'pro',
                planType: 'lifetime',
                licenseKey: 'LEGACY-PRO',
                activatedAt: Date.now(),
                expiresAt: null,
                themeMode: 'classic',
            };
        }
    } catch {
        // Local storage not available (SSR or test)
    }

    return {
        tier: 'free',
        planType: null,
        licenseKey: null,
        activatedAt: null,
        expiresAt: null,
        themeMode: 'classic',
    };
};

const saveState = (license: StoredLicense) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
        localStorage.setItem(LEGACY_KEY, license.tier !== 'free' ? 'true' : 'false');
    } catch {
        // Storage failure fallback
    }
};

export const getTierDisplayName = (tier: Tier, mode: ThemeMode): string => {
    if (mode === 'dbz') {
        switch (tier) {
            case 'god':
                return 'Super Saiyajin God (GOD)';
            case 'pro':
                return 'Super Saiyajin (PRO)';
            case 'free':
            default:
                return 'Guerrero Z (Base)';
        }
    }

    switch (tier) {
        case 'god':
            return 'Personal Budget GOD';
        case 'pro':
            return 'Personal Budget PRO';
        case 'free':
        default:
            return 'Plan Básico (Free)';
    }
};

export const useLicenseStore = create<LicenseState>((set, get) => {
    const initial = getInitialState();

    return {
        ...initial,
        isPro: initial.tier === 'pro' || initial.tier === 'god',
        isGod: initial.tier === 'god',
        isUpgradeModalOpen: false,
        upgradeModalReason: undefined,

        activateLicense: (rawKey: string) => {
            const key = rawKey.trim().toUpperCase();
            if (!key || key.length < 4) {
                return { success: false, message: 'La clave de licencia es demasiado corta o inválida.' };
            }

            let tier: Tier = 'pro';
            let planType: PlanType = 'lifetime';

            if (key.includes('GOD') || key.startsWith('GOD-') || key.includes('ULTRA')) {
                tier = 'god';
            } else if (key.includes('MONTH') || key.startsWith('M-')) {
                planType = 'monthly';
            } else if (key.includes('YEAR') || key.startsWith('Y-') || key.includes('ANNUAL')) {
                planType = 'annual';
            }

            const updated: StoredLicense = {
                tier,
                planType,
                licenseKey: key,
                activatedAt: Date.now(),
                expiresAt: planType === 'monthly' ? Date.now() + 30 * 24 * 60 * 60 * 1000 : planType === 'annual' ? Date.now() + 365 * 24 * 60 * 60 * 1000 : null,
                themeMode: get().themeMode,
            };

            saveState(updated);

            set({
                ...updated,
                isPro: true,
                isGod: tier === 'god',
                isUpgradeModalOpen: false,
                upgradeModalReason: undefined,
            });

            return {
                success: true,
                message: `¡Licencia activada con éxito! Nivel: ${getTierDisplayName(tier, get().themeMode)}`,
                tier,
            };
        },

        deactivateLicense: () => {
            const reset: StoredLicense = {
                tier: 'free',
                planType: null,
                licenseKey: null,
                activatedAt: null,
                expiresAt: null,
                themeMode: get().themeMode,
            };
            saveState(reset);
            set({
                ...reset,
                isPro: false,
                isGod: false,
            });
        },

        setThemeMode: (mode: ThemeMode) => {
            const updated = { ...get(), themeMode: mode };
            saveState(updated);
            set({ themeMode: mode });
        },

        openUpgradeModal: (reason?: string) => {
            set({ isUpgradeModalOpen: true, upgradeModalReason: reason });
        },

        closeUpgradeModal: () => {
            set({ isUpgradeModalOpen: false, upgradeModalReason: undefined });
        },

        canCreateAccount: (currentCount: number) => {
            const { isPro } = get();
            return isPro || currentCount < FREE_LIMITS.maxAccounts;
        },

        canCreateReserve: (currentCount: number) => {
            const { isPro } = get();
            return isPro || currentCount < FREE_LIMITS.maxReserves;
        },

        canCreateTemplate: (currentCount: number) => {
            const { isPro } = get();
            return isPro || currentCount < FREE_LIMITS.maxTemplates;
        },

        canUseAi: () => {
            return get().isPro;
        },

        canExportCsv: () => {
            return get().isPro;
        },
    };
});
