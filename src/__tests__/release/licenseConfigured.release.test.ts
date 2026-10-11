import { describe, expect, it } from 'vitest';
import { LEMON_STORE_ID, isLicenseConfigured } from '@/lib/license/licenseConfig';

/**
 * RELEASE GATE. This reads the real configuration (.env), not a mock.
 *
 * Licenses are only accepted from our own Lemon Squeezy store, identified by the VITE_LEMON_* ids
 * in .env. If they are empty nobody can activate a license, including people who already paid.
 * This test goes red until they are filled in, so a build without them cannot be merged by mistake.
 */
describe('release gate: Lemon Squeezy IDs are configured', () => {
    it('has the store id and at least one product or variant that grants a tier', () => {
        expect(
            isLicenseConfigured(),
            'Faltan los IDs de Lemon Squeezy en .env (VITE_LEMON_STORE_ID y los productos/variantes PRO o GOD). ' +
                'Sin ellos no se puede activar ninguna licencia.'
        ).toBe(true);
    });

    it('has a numeric store id', () => {
        expect(LEMON_STORE_ID, 'VITE_LEMON_STORE_ID debe ser el id numérico de la tienda').toMatch(/^\d+$/);
    });
});
