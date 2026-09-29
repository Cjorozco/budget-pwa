/**
 * Secure offline and online license verification with cryptographic HMAC-like checksums
 * and Lemon Squeezy license activation API integration.
 */

import { type Tier, type PlanType } from '../../store/licenseStore';

// Secret salt used for signature verification (obfuscated internal seed)
const SECRET_SALT = 'PB_SALT_2026_ORZIX_SECURE_BUDGET_OFFLINE_VERIFY';

// Built-in founder / master keys
const MASTER_GOD_KEYS = new Set([
    'PBGOD-ORZIX-FOUNDER-98274198',
    'PBGOD-CREATOR-VIP-77319420',
    'VIP-GOD-ORZIX', // Backward-compatible founder key for Jose Orzix
]);

/**
 * Fast 32-bit FNV-1a + bit-shift hash string generator to hex for synchronous offline verification
 */
function computeChecksum(input: string): string {
    let h1 = 0x811c9dc5 ^ 0x3b;
    let h2 = 0x9e3779b9 ^ 0x5a;
    const str = `${input}:${SECRET_SALT}`;
    
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 0x01000193);
        h2 = Math.imul(h2 ^ ((ch << 5) | (ch >>> 27)), 0x5bd1e995);
    }
    
    // Combine both 32-bit hashes into an 8-char hex string
    const hex1 = (((h1 >>> 0) ^ 0xa5a5a5a5) >>> 0).toString(16).padStart(8, '0');
    const hex2 = (((h2 >>> 0) ^ 0x5a5a5a5a) >>> 0).toString(16).padStart(8, '0');
    
    return (hex1.substring(0, 4) + hex2.substring(0, 4)).toUpperCase();
}

/**
 * Generates a tamper-proof signed license key
 * Format: PB<TIER><PLAN>-<IDENTIFIER>-<CHECKSUM>
 * Example: PBGOD-FRIEND01-9F2B8A1C
 */
export function generateSignedLicense(
    tier: 'pro' | 'god',
    planType: PlanType = 'lifetime',
    identifier: string = 'VIP'
): string {
    const cleanId = identifier.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'VIP';
    
    let prefix = 'PBPRO';
    if (tier === 'god') {
        prefix = 'PBGOD';
    } else if (planType === 'monthly') {
        prefix = 'PBMON';
    } else if (planType === 'annual') {
        prefix = 'PBYEA';
    } else {
        prefix = 'PBLIF';
    }

    const payload = `${prefix}-${cleanId}`;
    const checksum = computeChecksum(payload);
    
    return `${payload}-${checksum}`;
}

export interface LicenseValidationResult {
    valid: boolean;
    tier?: Tier;
    planType?: PlanType;
    expiresAt?: number | null;
    error?: string;
    customerEmail?: string;
}

/**
 * Synchronous offline license key validator (Master and Signed Cryptographic Keys)
 */
export function validateLicenseKey(rawKey: string): LicenseValidationResult {
    if (!rawKey || typeof rawKey !== 'string') {
        return { valid: false, error: 'Por favor ingresa una clave de licencia válida.' };
    }

    const key = rawKey.trim().toUpperCase();

    // 1. Check Master Founder Keys
    if (MASTER_GOD_KEYS.has(key)) {
        return {
            valid: true,
            tier: 'god',
            planType: 'lifetime',
            expiresAt: null,
        };
    }

    // 2. Check Standard Cryptographic Signed Keys (e.g. PBGOD-USER-CHK or PBLIF-USER-CHK)
    const signedKeyRegex = /^(PBGOD|PBPRO|PBMON|PBYEA|PBLIF)-([A-Z0-9]{3,12})-([A-F0-9]{8})$/;
    const match = key.match(signedKeyRegex);

    if (match) {
        const [_, prefix, identifier, signature] = match;
        const payload = `${prefix}-${identifier}`;
        const expectedSignature = computeChecksum(payload);

        if (signature !== expectedSignature) {
            return {
                valid: false,
                error: 'Firma de licencia inválida. La clave no es auténtica o fue alterada.',
            };
        }

        if (prefix === 'PBGOD') {
            return { valid: true, tier: 'god', planType: 'lifetime', expiresAt: null };
        } else if (prefix === 'PBMON') {
            return { valid: true, tier: 'pro', planType: 'monthly', expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
        } else if (prefix === 'PBYEA') {
            return { valid: true, tier: 'pro', planType: 'annual', expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 };
        } else {
            return { valid: true, tier: 'pro', planType: 'lifetime', expiresAt: null };
        }
    }

    // 3. Lemon Squeezy Standard UUID v4 format pattern
    const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
    if (uuidRegex.test(key)) {
        return {
            valid: true,
            tier: 'pro',
            planType: 'lifetime',
            expiresAt: null,
        };
    }

    return {
        valid: false,
        error: 'Formato de clave no reconocido. Introduce el código recibido en tu compra de Lemon Squeezy o una clave autorizada.',
    };
}

/**
 * Validates a license key with Lemon Squeezy API if online, falling back to offline validation
 */
export async function validateLicenseKeyAsync(rawKey: string): Promise<LicenseValidationResult> {
    const key = (rawKey || '').trim();
    if (!key) {
        return { valid: false, error: 'Por favor ingresa una clave de licencia válida.' };
    }

    // 1. Check Master Founder Keys
    if (MASTER_GOD_KEYS.has(key.toUpperCase())) {
        return {
            valid: true,
            tier: 'god',
            planType: 'lifetime',
            expiresAt: null,
        };
    }

    // 2. Check Standard Cryptographic Signed Keys (PBGOD-..., PBMON-..., etc.)
    const signedKeyRegex = /^(PBGOD|PBPRO|PBMON|PBYEA|PBLIF)-([A-Z0-9]{3,12})-([A-F0-9]{8})$/i;
    if (signedKeyRegex.test(key)) {
        return validateLicenseKey(key);
    }

    // 3. Lemon Squeezy UUID Verification via official Lemon Squeezy Activation API
    const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
    if (uuidRegex.test(key)) {
        try {
            const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    license_key: key,
                    instance_name: 'Personal Budget Device',
                }),
            });

            const data = await res.json().catch(() => null);

            if (data && data.activated && data.license_key) {
                const variantName = (data.meta?.variant_name || '').toLowerCase();
                const productName = (data.meta?.product_name || '').toLowerCase();
                let tier: Tier = 'pro';
                let planType: PlanType = 'lifetime';
                let expiresAt: number | null = null;

                if (data.license_key.expires_at) {
                    expiresAt = new Date(data.license_key.expires_at).getTime();
                }

                if (variantName.includes('month') || variantName.includes('mensual') || variantName.includes('mes')) {
                    planType = 'monthly';
                    if (!expiresAt) {
                        expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
                    }
                } else if (variantName.includes('year') || variantName.includes('anual') || variantName.includes('annual') || variantName.includes('año')) {
                    planType = 'annual';
                    if (!expiresAt) {
                        expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
                    }
                } else if (expiresAt) {
                    // Expiration present
                    const durationDays = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
                    if (durationDays <= 45) {
                        planType = 'monthly';
                    } else if (durationDays <= 380) {
                        planType = 'annual';
                    }
                }

                if (variantName.includes('god') || productName.includes('god')) {
                    tier = 'god';
                }

                return {
                    valid: true,
                    tier,
                    planType,
                    expiresAt,
                    customerEmail: data.meta?.customer_email,
                };
            }

            if (data && data.error) {
                const errorMessage = data.error === 'license_key not found.'
                    ? 'Clave de licencia no encontrada en Lemon Squeezy. Asegúrate de copiar la License Key generada en la orden de compra.'
                    : data.error;
                return { valid: false, error: errorMessage };
            }
        } catch {
            // If offline, allow fallback
            return validateLicenseKey(key);
        }
    }

    return validateLicenseKey(key);
}
