import { describe, it, expect } from 'vitest';
import {
    validateLicenseKey,
    generateSignedLicense,
} from '../../../lib/license/licenseValidator';

describe('licenseValidator', () => {
    it('rejects trivial guessable strings', () => {
        expect(validateLicenseKey('god').valid).toBe(false);
        expect(validateLicenseKey('GOD').valid).toBe(false);
        expect(validateLicenseKey('VIP-GOD').valid).toBe(false);
        expect(validateLicenseKey('PRO-TEST-1234').valid).toBe(false);
        expect(validateLicenseKey('1234567890').valid).toBe(false);
        expect(validateLicenseKey('SOMETHINGGOD').valid).toBe(false);
    });

    it('validates master founder key for Jose Orzix', () => {
        const result = validateLicenseKey('VIP-GOD-ORZIX');
        expect(result.valid).toBe(true);
        expect(result.tier).toBe('god');
        expect(result.planType).toBe('lifetime');
    });

    it('generates and validates authentic cryptographic signed keys', () => {
        const godKey = generateSignedLicense('god', 'lifetime', 'ORZIXVIP');
        const proMonthly = generateSignedLicense('pro', 'monthly', 'CLIENT01');
        const proAnnual = generateSignedLicense('pro', 'annual', 'CLIENT02');
        const proLifetime = generateSignedLicense('pro', 'lifetime', 'FRIEND');

        // Check God key
        const godResult = validateLicenseKey(godKey);
        expect(godResult.valid).toBe(true);
        expect(godResult.tier).toBe('god');
        expect(godResult.planType).toBe('lifetime');

        // Check Pro Monthly key
        const monthlyResult = validateLicenseKey(proMonthly);
        expect(monthlyResult.valid).toBe(true);
        expect(monthlyResult.tier).toBe('pro');
        expect(monthlyResult.planType).toBe('monthly');

        // Check Pro Annual key
        const annualResult = validateLicenseKey(proAnnual);
        expect(annualResult.valid).toBe(true);
        expect(annualResult.tier).toBe('pro');
        expect(annualResult.planType).toBe('annual');

        // Check Pro Lifetime key
        const lifetimeResult = validateLicenseKey(proLifetime);
        expect(lifetimeResult.valid).toBe(true);
        expect(lifetimeResult.tier).toBe('pro');
        expect(lifetimeResult.planType).toBe('lifetime');
    });

    it('detects tampering in cryptographic signed keys', () => {
        const key = generateSignedLicense('god', 'lifetime', 'ORZIXVIP');
        // Alter 1 character in the checksum
        const tampered = key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A');
        const result = validateLicenseKey(tampered);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Firma de licencia inválida');
    });

    it('validates authentic Lemon Squeezy UUID v4 keys', () => {
        const result = validateLicenseKey('c45c6116-d975-43d9-9995-cc8811d926f7');
        expect(result.valid).toBe(true);
        expect(result.tier).toBe('pro');
        expect(result.planType).toBe('lifetime');
    });
});
