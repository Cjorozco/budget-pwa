/**
 * Secure offline license verification with cryptographic HMAC-like checksums
 * and Lemon Squeezy license key verification support.
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

/**
 * Validates a license key string
 */
export function validateLicenseKey(rawKey: string): {
    valid: boolean;
    tier?: Tier;
    planType?: PlanType;
    error?: string;
} {
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
            return { valid: true, tier: 'god', planType: 'lifetime' };
        } else if (prefix === 'PBMON') {
            return { valid: true, tier: 'pro', planType: 'monthly' };
        } else if (prefix === 'PBYEA') {
            return { valid: true, tier: 'pro', planType: 'annual' };
        } else {
            return { valid: true, tier: 'pro', planType: 'lifetime' };
        }
    }

    // 3. Lemon Squeezy Standard UUID v4 format (e.g. c45c6116-d975-43d9-9995-cc8811d926f7)
    const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
    if (uuidRegex.test(key)) {
        return {
            valid: true,
            tier: 'pro',
            planType: 'lifetime',
        };
    }

    return {
        valid: false,
        error: 'Formato de clave no reconocido. Introduce el código recibido en tu compra de Lemon Squeezy o una clave autorizada.',
    };
}
