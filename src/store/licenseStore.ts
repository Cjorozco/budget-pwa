import { create } from 'zustand';
import {
    activateLicenseKey,
    revalidateLicenseKey,
    deactivateLicenseKey,
    isLemonKeyFormat,
    type LicenseValidationResult,
} from '../lib/license/licenseValidator';
import { OFFLINE_GRACE_DAYS, REVALIDATE_INTERVAL_HOURS } from '../lib/license/licenseConfig';
import { useUIStore } from './ui';

/** Single paid tier, unlocked by a one-time supporter purchase. */
export type Tier = 'free' | 'pro';

export interface StoredLicense {
    tier: Tier;
    licenseKey: string | null;
    activatedAt: number | null;
    expiresAt: number | null;
    instanceId: string | null;
    lastValidatedAt: number | null;
}

export const FREE_LIMITS = {
    maxAccounts: 2,
    maxReserves: 1,
    maxTemplates: 2,
    maxTags: 3,
} as const;

interface LicenseState extends StoredLicense {
    isPro: boolean;
    isUpgradeModalOpen: boolean;
    upgradeModalReason?: string;

    // Actions
    activateLicense: (key: string) => Promise<{ success: boolean; message: string; tier?: Tier }>;
    deactivateLicense: () => void;
    /** Online revalidation. Without `force` it runs at most once every REVALIDATE_INTERVAL_HOURS. */
    revalidateLicense: (options?: { force?: boolean }) => Promise<void>;
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
// Removed flag from older versions. Built from parts so the shipped bundle carries no trace of the old name.
const REMOVED_PRO_FLAG_KEY = ['budget', 'is', 'pro'].join('_');

const DAY_MS = 24 * 60 * 60 * 1000;

const EMPTY_LICENSE: StoredLicense = {
    tier: 'free',
    licenseKey: null,
    activatedAt: null,
    expiresAt: null,
    instanceId: null,
    lastValidatedAt: null,
};

const MSG_REACTIVATE = 'Tu licencia anterior ya no es válida. Reactívala con la clave de tu compra de Lemon Squeezy.';
const MSG_EXPIRED = 'Tu licencia expiró. Puedes apoyar el proyecto con un pago único para recuperar las funciones PRO.';
const MSG_GRACE = 'Conéctate a internet para verificar tu licencia.';

interface Notice {
    message: string;
    type: 'info' | 'error';
}

// Notices produced while loading state; shown once by startLicenseLifecycle.
let pendingNotices: Notice[] = [];

const saveState = (license: StoredLicense) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
    } catch {
        // Storage failure fallback
    }
};

const isPaidTier = (tier: Tier) => tier === 'pro';

/** Free tier that keeps the key, so a later successful revalidation can restore it. */
const suspend = (license: StoredLicense): StoredLicense => ({
    ...license,
    tier: 'free',
    expiresAt: null,
});

/**
 * Applies local-only rules to a paid license: expiry (legacy subscriptions) and offline grace period.
 * Returns the license unchanged when it is still allowed to run.
 */
const applyLocalLimits = (license: StoredLicense, now: number): { license: StoredLicense; notice?: Notice } => {
    if (!isPaidTier(license.tier)) return { license };

    if (license.expiresAt !== null && license.expiresAt <= now) {
        return { license: suspend(license), notice: { message: MSG_EXPIRED, type: 'info' } };
    }
    if (license.lastValidatedAt === null || now - license.lastValidatedAt > OFFLINE_GRACE_DAYS * DAY_MS) {
        return { license: suspend(license), notice: { message: MSG_GRACE, type: 'info' } };
    }
    return { license };
};

const getInitialState = (): StoredLicense => {
    const now = Date.now();
    try {
        // The old flag never proves anything: always drop it.
        localStorage.removeItem(REMOVED_PRO_FLAG_KEY);

        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return { ...EMPTY_LICENSE };

        const parsed = JSON.parse(stored);
        const licenseKey: string | null = typeof parsed.licenseKey === 'string' ? parsed.licenseKey : null;

        if (!licenseKey) {
            // Paid tier without any key is not a license.
            if (parsed.tier && parsed.tier !== 'free') saveState(EMPTY_LICENSE);
            return { ...EMPTY_LICENSE };
        }

        // Non-Lemon keys (signed, master or legacy) are retired: back to free, once.
        if (!isLemonKeyFormat(licenseKey)) {
            saveState(EMPTY_LICENSE);
            pendingNotices.push({ message: MSG_REACTIVATE, type: 'info' });
            return { ...EMPTY_LICENSE };
        }

        let license: StoredLicense = {
            // The retired GOD tier folds into PRO; the old planType field is ignored.
            tier: parsed.tier === 'god' || parsed.tier === 'pro' ? 'pro' : 'free',
            licenseKey,
            activatedAt: parsed.activatedAt || null,
            expiresAt: parsed.expiresAt || null,
            instanceId: typeof parsed.instanceId === 'string' ? parsed.instanceId : null,
            lastValidatedAt: typeof parsed.lastValidatedAt === 'number' ? parsed.lastValidatedAt : null,
        };

        // Pre-existing UUID license never validated by this version: pending revalidation,
        // grace starts now instead of dropping the user immediately.
        if (isPaidTier(license.tier) && license.lastValidatedAt === null) {
            license = { ...license, lastValidatedAt: now };
            saveState(license);
        }

        const limited = applyLocalLimits(license, now);
        if (limited.notice) {
            pendingNotices.push(limited.notice);
            saveState(limited.license);
        }
        return limited.license;
    } catch {
        // Local storage not available (SSR or test)
    }

    return { ...EMPTY_LICENSE };
};

export const getTierDisplayName = (tier: Tier): string =>
    tier === 'pro' ? 'Personal Budget PRO' : 'Plan Básico (Free)';

const notify = (notice: Notice) => useUIStore.getState().addToast(notice.message, notice.type);

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

let revalidating = false;

export const useLicenseStore = create<LicenseState>((set, get) => {
    const initial = getInitialState();

    /** Replaces the license portion of the state and persists it. */
    const commit = (license: StoredLicense, extra: Partial<LicenseState> = {}) => {
        saveState(license);
        set({
            ...license,
            isPro: isPaidTier(license.tier),
            ...extra,
        });
    };

    const licenseOf = (state: LicenseState): StoredLicense => ({
        tier: state.tier,
        licenseKey: state.licenseKey,
        activatedAt: state.activatedAt,
        expiresAt: state.expiresAt,
        instanceId: state.instanceId,
        lastValidatedAt: state.lastValidatedAt,
    });

    return {
        ...initial,
        isPro: isPaidTier(initial.tier),
        isUpgradeModalOpen: false,
        upgradeModalReason: undefined,

        activateLicense: async (rawKey: string) => {
            const validation: LicenseValidationResult = await activateLicenseKey(rawKey);

            if (!validation.valid || !validation.tier) {
                return {
                    success: false,
                    message: validation.error || 'Clave de licencia inválida o no reconocida.',
                };
            }

            const tier = validation.tier;
            const now = Date.now();

            commit(
                {
                    tier,
                    licenseKey: rawKey.trim(),
                    activatedAt: now,
                    expiresAt: validation.expiresAt ?? null,
                    instanceId: validation.instanceId ?? null,
                    lastValidatedAt: now,
                },
                { isUpgradeModalOpen: false, upgradeModalReason: undefined },
            );

            return {
                success: true,
                message: '¡Gracias por tu apoyo! Personal Budget PRO quedó activado.',
                tier,
            };
        },

        revalidateLicense: async (options) => {
            const start = get();
            const key = start.licenseKey;
            if (!key || revalidating || !isOnline()) return;

            const now = Date.now();
            const wasPaid = isPaidTier(start.tier);
            const recentlyValidated =
                start.lastValidatedAt !== null && now - start.lastValidatedAt < REVALIDATE_INTERVAL_HOURS * 60 * 60 * 1000;
            if (!options?.force && wasPaid && recentlyValidated) return;

            revalidating = true;
            let result: LicenseValidationResult;
            try {
                result = await revalidateLicenseKey(key, start.instanceId);
            } finally {
                revalidating = false;
            }

            // Network trouble is not a verdict: leave everything as it is.
            if (result.reason === 'network') return;
            // The license changed while we were waiting (deactivated or replaced).
            if (get().licenseKey !== key) return;

            if (result.valid && result.tier) {
                const current = get();
                commit({
                    ...licenseOf(current),
                    tier: result.tier,
                    expiresAt: result.expiresAt ?? null,
                    instanceId: result.instanceId ?? current.instanceId,
                    activatedAt: current.activatedAt ?? Date.now(),
                    lastValidatedAt: Date.now(),
                });
                if (!wasPaid) {
                    notify({ message: 'Licencia verificada. Tus funciones PRO fueron restauradas.', type: 'info' });
                }
                return;
            }

            if (result.reason === 'expired') {
                commit(suspend(licenseOf(get())));
                if (wasPaid) notify({ message: MSG_EXPIRED, type: 'info' });
                return;
            }

            // Invalid, disabled or unknown to Lemon Squeezy: drop it entirely.
            commit({ ...EMPTY_LICENSE });
            if (wasPaid) {
                notify({
                    message: `Tu licencia ya no es válida (${result.error || 'rechazada por Lemon Squeezy'}). Volviste al plan básico.`,
                    type: 'error',
                });
            }
        },

        deactivateLicense: () => {
            const { licenseKey, instanceId } = get();
            // Best-effort and non-blocking: local state is cleared regardless of the outcome.
            if (licenseKey && instanceId && isOnline()) {
                void deactivateLicenseKey(licenseKey, instanceId);
            }
            commit({ ...EMPTY_LICENSE });
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

let lifecycleStarted = false;

/**
 * Shows notices produced while loading, enforces local limits (expiry, offline grace)
 * and revalidates against Lemon Squeezy at startup, when the device comes back online
 * and when the app becomes visible again. Safe to call more than once.
 */
export function startLicenseLifecycle(): void {
    const notices = pendingNotices;
    pendingNotices = [];
    notices.forEach(notify);

    const enforceLocalLimits = () => {
        const state = useLicenseStore.getState();
        const { license, notice } = applyLocalLimits(
            {
                tier: state.tier,
                licenseKey: state.licenseKey,
                activatedAt: state.activatedAt,
                expiresAt: state.expiresAt,
                instanceId: state.instanceId,
                lastValidatedAt: state.lastValidatedAt,
            },
            Date.now(),
        );
        if (!notice) return;
        saveState(license);
        useLicenseStore.setState({ ...license, isPro: false });
        notify(notice);
    };

    const check = (force: boolean) => {
        enforceLocalLimits();
        void useLicenseStore.getState().revalidateLicense({ force });
    };

    check(false);

    if (lifecycleStarted || typeof window === 'undefined') return;
    lifecycleStarted = true;
    // A suspended license (offline grace exceeded) is retried on every reconnect.
    window.addEventListener('online', () => check(true));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check(false);
    });
}
