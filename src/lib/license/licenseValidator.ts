/**
 * Lemon Squeezy license client (activate / validate / deactivate).
 *
 * The only way to get a paid tier is a real license from our own store, activated online.
 * There is no offline key format: a UUID-shaped string is NOT a license by itself.
 */

import { type Tier } from '../../store/licenseStore';
import { LEMON_STORE_ID, isLicenseConfigured, PRO_PRODUCT_IDS, PRO_VARIANT_IDS } from './licenseConfig';

const LEMON_API = 'https://api.lemonsqueezy.com/v1/licenses';

export const NEEDS_INTERNET_MESSAGE = 'Necesitas internet para activar tu licencia.';
export const NOT_CONFIGURED_MESSAGE = 'La activación de licencias no está configurada en esta versión de la app.';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape check only. Says nothing about whether the license is real. */
export function isLemonKeyFormat(key: string | null | undefined): boolean {
    return typeof key === 'string' && UUID_REGEX.test(key.trim());
}

export type LicenseFailureReason = 'invalid' | 'expired' | 'network';

export interface LicenseValidationResult {
    valid: boolean;
    tier?: Tier;
    expiresAt?: number | null;
    instanceId?: string | null;
    error?: string;
    /** Set when valid is false. 'network' means Lemon could not be reached or answered unusably. */
    reason?: LicenseFailureReason;
    customerEmail?: string;
}

interface LemonLicenseResponse {
    activated?: boolean;
    valid?: boolean;
    deactivated?: boolean;
    error?: string | null;
    license_key?: { status?: string; expires_at?: string | null };
    instance?: { id?: string | number } | null;
    meta?: {
        store_id?: number | string;
        product_id?: number | string;
        variant_id?: number | string;
        product_name?: string;
        variant_name?: string;
        customer_email?: string;
    };
}

const networkFailure = (error: string): LicenseValidationResult => ({ valid: false, reason: 'network', error });

async function postLicense(
    endpoint: 'activate' | 'validate' | 'deactivate',
    params: Record<string, string>,
): Promise<{ data: LemonLicenseResponse } | { networkError: true }> {
    try {
        const res = await fetch(`${LEMON_API}/${endpoint}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params),
        });
        const data = (await res.json().catch(() => null)) as LemonLicenseResponse | null;
        // 5xx or unparsable body: Lemon could not give a verdict, same as being offline.
        if (!data || typeof data !== 'object' || res.status >= 500) return { networkError: true };
        return { data };
    } catch {
        return { networkError: true };
    }
}

const inList = (list: readonly string[], id: unknown): boolean =>
    id !== undefined && id !== null && list.includes(String(id));

const grantsPro = (meta: NonNullable<LemonLicenseResponse['meta']>): boolean =>
    inList(PRO_PRODUCT_IDS, meta.product_id) || inList(PRO_VARIANT_IDS, meta.variant_id);

/** Applies status / store / product checks shared by activate and validate. */
function interpret(data: LemonLicenseResponse, ok: boolean): LicenseValidationResult {
    if (!ok) {
        const raw = data.error || '';
        const error = /not found/i.test(raw)
            ? 'Clave de licencia no encontrada. Copia la clave que recibiste en tu compra.'
            : /activation limit/i.test(raw)
            ? 'Esta licencia ya alcanzó su límite de dispositivos. Desactívala en otro dispositivo o escribe a soporte.'
            : raw || 'Licencia no válida.';
        return { valid: false, reason: 'invalid', error };
    }

    const meta = data.meta;
    if (!meta || !LEMON_STORE_ID || String(meta.store_id) !== LEMON_STORE_ID) {
        return { valid: false, reason: 'invalid', error: 'Esta licencia no pertenece a Personal Budget.' };
    }

    if (!grantsPro(meta)) {
        return { valid: false, reason: 'invalid', error: 'Esta licencia no corresponde a un plan de Personal Budget.' };
    }

    const status = data.license_key?.status;
    if (status === 'expired') {
        return { valid: false, reason: 'expired', error: 'Tu licencia expiró.' };
    }
    if (status !== 'active') {
        return { valid: false, reason: 'invalid', error: 'Tu licencia está desactivada o no está vigente.' };
    }

    const rawExpiry = data.license_key?.expires_at;
    const parsed = rawExpiry ? new Date(rawExpiry).getTime() : null;
    const expiresAt = parsed !== null && !Number.isNaN(parsed) ? parsed : null;
    if (expiresAt !== null && expiresAt <= Date.now()) {
        return { valid: false, reason: 'expired', error: 'Tu licencia expiró.' };
    }

    return {
        valid: true,
        tier: 'pro',
        expiresAt,
        instanceId: data.instance?.id !== undefined ? String(data.instance.id) : null,
        customerEmail: meta.customer_email,
    };
}

/** Activates a license key online (POST /v1/licenses/activate). Never succeeds without network. */
export async function activateLicenseKey(rawKey: string): Promise<LicenseValidationResult> {
    const key = (rawKey || '').trim();
    if (!isLemonKeyFormat(key)) {
        return { valid: false, reason: 'invalid', error: 'Introduce la clave de licencia que recibiste en tu compra de Lemon Squeezy.' };
    }

    // Without the store and product IDs nothing can be verified: refuse instead of guessing.
    if (!isLicenseConfigured()) return { valid: false, reason: 'invalid', error: NOT_CONFIGURED_MESSAGE };

    const response = await postLicense('activate', { license_key: key, instance_name: 'Personal Budget Device' });
    if ('networkError' in response) return networkFailure(NEEDS_INTERNET_MESSAGE);

    const result = interpret(response.data, response.data.activated === true);
    if (result.valid && !result.instanceId) {
        return { valid: false, reason: 'invalid', error: 'Lemon Squeezy no devolvió una instancia de activación.' };
    }
    return result;
}

/** Revalidates an activated license (POST /v1/licenses/validate). */
export async function revalidateLicenseKey(key: string, instanceId: string | null): Promise<LicenseValidationResult> {
    // A deployment without the IDs must not log out paying customers: no verdict, they keep their
    // offline grace period while the configuration gets fixed.
    if (!isLicenseConfigured()) return networkFailure(NOT_CONFIGURED_MESSAGE);

    const params: Record<string, string> = { license_key: key };
    if (instanceId) params.instance_id = instanceId;

    const response = await postLicense('validate', params);
    if ('networkError' in response) return networkFailure('No se pudo contactar a Lemon Squeezy.');

    const result = interpret(response.data, response.data.valid === true);
    // validate does not always echo the instance; keep the one we already hold.
    if (result.valid && !result.instanceId) result.instanceId = instanceId;
    return result;
}

/** Best-effort remote deactivation (POST /v1/licenses/deactivate). Never throws. */
export async function deactivateLicenseKey(key: string, instanceId: string): Promise<void> {
    await postLicense('deactivate', { license_key: key, instance_id: instanceId });
}
