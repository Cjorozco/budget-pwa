import { create } from 'zustand';
import { validateLicenseKeyAsync } from '../lib/license/licenseValidator';

export type Tier = 'free' | 'pro' | 'god';
export type PlanType = 'monthly' | 'annual' | 'lifetime';

export interface StoredLicense {
    tier: Tier;
    planType: PlanType | null;
    licenseKey: string | null;
    activatedAt: number | null;
    expiresAt: number | null;
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
    activateLicense: (key: string) => Promise<{ success: boolean; message: string; tier?: Tier; planType?: PlanType }>;
    deactivateLicense: () => void;
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

export const getTierDisplayName = (tier: Tier): string => {
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

        activateLicense: async (rawKey: string) => {
            const validation = await validateLicenseKeyAsync(rawKey);

            if (!validation.valid || !validation.tier) {
                return {
                    success: false,
                    message: validation.error || 'Clave de licencia inválida o no reconocida.',
                };
            }

            const tier = validation.tier;
            const planType = validation.planType || 'lifetime';
            const expiresAt = validation.expiresAt !== undefined 
                ? validation.expiresAt 
                : (planType === 'monthly' ? Date.now() + 30 * 24 * 60 * 60 * 1000 : planType === 'annual' ? Date.now() + 365 * 24 * 60 * 60 * 1000 : null);
            const key = rawKey.trim().toUpperCase();

            const updated: StoredLicense = {
                tier,
                planType,
                licenseKey: key,
                activatedAt: Date.now(),
                expiresAt,
            };

            saveState(updated);

            set({
                ...updated,
                isPro: true,
                isGod: tier === 'god',
                isUpgradeModalOpen: false,
                upgradeModalReason: undefined,
            });

            const planLabel = planType === 'monthly' ? ' (Suscripción Mensual)' : planType === 'annual' ? ' (Suscripción Anual)' : ' (Vitalicio / Lifetime)';

            return {
                success: true,
                message: `¡Licencia activada con éxito! Nivel: ${getTierDisplayName(tier)}${tier !== 'god' ? planLabel : ''}`,
                tier,
                planType,
            };
        },

        deactivateLicense: () => {
            const reset: StoredLicense = {
                tier: 'free',
                planType: null,
                licenseKey: null,
                activatedAt: null,
                expiresAt: null,
            };
            saveState(reset);
            set({
                ...reset,
                isPro: false,
                isGod: false,
            });
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
