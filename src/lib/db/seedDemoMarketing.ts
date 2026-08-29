/**
 * Seed de datos FICTICIOS para grabar el video de marketing.
 *
 * Solo corre en localhost (npm run dev). Nunca se incluye en el bundle de
 * producción si se importa detrás de `import.meta.env.DEV`.
 *
 * Reset para regrabar: Ajustes → Reset total → recargar → volver a sembrar.
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from './index';
import { findOrCreateCategory } from '../ai/categoryResolver';
import { normalizeForMatch } from '../ai/categoryRules';
import { formatCurrency } from '../utils';
import type { Transaction } from '../types';

if (import.meta.env.PROD) {
    throw new Error('seedDemoMarketing no debe cargarse en producción.');
}

const RECONCILE_GAP_COP = 35_000;
const BANCOLOMBIA_OPENING = 2_400_000;
const EFECTIVO_OPENING = 180_000;
const RESERVE_AMOUNT = 400_000;

export interface DemoSeedResult {
    bancolombiaCalculated: number;
    /** Número a escribir en cámara en reconciliación (calculado + 35.000) */
    bancolombiaDeclaredOnCamera: number;
    efectivoCalculated: number;
}

function assertLocalhostDemoOnly(): void {
    if (import.meta.env.PROD) {
        throw new Error('Seed de demo bloqueado: build de producción.');
    }

    if (typeof window === 'undefined') {
        throw new Error('Seed de demo solo corre en el navegador.');
    }

    const { hostname, origin } = window.location;
    const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]';

    if (!isLocalhost) {
        throw new Error(
            `Seed de demo bloqueado: origin "${origin}" no es localhost. ` +
            'Esta función nunca toca la PWA de producción.'
        );
    }
}

function atLocalNoon(year: number, monthIndex: number, day: number): number {
    return new Date(year, monthIndex, day, 12, 0, 0, 0).getTime();
}

function monthDay(monthOffset: number, day: number): number {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return atLocalNoon(d.getFullYear(), d.getMonth(), Math.min(day, lastDay));
}

async function requireCategory(parentName: string, subcategoryName?: string): Promise<string> {
    return findOrCreateCategory('expense', parentName, subcategoryName);
}

/**
 * Quita Sofia › Transporte si una migración previa la creó.
 * Si existe, el formulario auto-rellena el <select> y nunca muestra
 * "Crear y aplicar" (la escena 2 del video).
 */
async function removeSofiaTransportForLiveDemo(): Promise<void> {
    const categories = await db.categories.filter((c) => c.type === 'expense').toArray();
    const sofia = categories.find(
        (c) => !c.parentId && normalizeForMatch(c.name) === 'sofia'
    );
    if (!sofia) return;

    const children = categories.filter((c) => c.parentId === sofia.id);
    const transportKids = children.filter((c) => normalizeForMatch(c.name) === 'transporte');
    if (transportKids.length > 0) {
        await db.categories.bulkDelete(transportKids.map((c) => c.id));
    }
    if (children.length === transportKids.length) {
        await db.categories.delete(sofia.id);
    }
}

/**
 * Borra movimientos/reservas/reconciliaciones locales y carga el set de demo.
 * No lee ni escribe orígenes distintos a localhost.
 */
export async function seedDemoMarketing(): Promise<DemoSeedResult> {
    assertLocalhostDemoOnly();

    const supermarket = await requireCategory('Gastos diarios', 'Supermercado');
    const restaurants = await requireCategory('Gastos diarios', 'Restaurantes');
    const subscriptions = await requireCategory('Gastos diarios', 'Suscripciones');
    const transportPrivate = await requireCategory('Transporte', 'Privado');
    const transportPublic = await requireCategory('Transporte', 'Transporte público');
    const electricity = await requireCategory('Servicios básicos', 'Electricidad');
    const phone = await requireCategory('Servicios básicos', 'Teléfono/Celular');
    const cinema = await requireCategory('Ocio', 'Cine');
    const sport = await requireCategory('Ocio', 'Deporte');
    const pharmacy = await requireCategory('Salud/médicos', 'Farmacia');
    const housing = await requireCategory('Vivienda', 'Alquiler o hipoteca');
    const otherExpense = await requireCategory('Gastos diarios', 'Otros');
    const refunds = await findOrCreateCategory('income', 'Otros', 'Reembolsos');

    const now = Date.now();

    type DraftTx = {
        description: string;
        amount: number;
        type: 'income' | 'expense';
        account: 'bancolombia' | 'efectivo';
        categoryId: string;
        date: number;
        isAmbiguous?: boolean;
        aiConfidence?: number;
        needsReview?: boolean;
    };

    // Sin "Uber al jardín" / jardín / Sofía: eso se escribe en cámara.
    const drafts: DraftTx[] = [
        // --- Mes anterior ---
        { description: 'Éxito', amount: 186_400, type: 'expense', account: 'bancolombia', categoryId: supermarket, date: monthDay(-1, 4) },
        { description: 'Uber', amount: 18_200, type: 'expense', account: 'bancolombia', categoryId: transportPrivate, date: monthDay(-1, 6) },
        { description: 'Netflix', amount: 44_900, type: 'expense', account: 'bancolombia', categoryId: subscriptions, date: monthDay(-1, 8) },
        { description: 'Farmatodo', amount: 37_800, type: 'expense', account: 'bancolombia', categoryId: pharmacy, date: monthDay(-1, 11) },
        { description: 'Cine Colombia', amount: 32_000, type: 'expense', account: 'bancolombia', categoryId: cinema, date: monthDay(-1, 14) },
        { description: 'EPM energía', amount: 128_500, type: 'expense', account: 'bancolombia', categoryId: electricity, date: monthDay(-1, 16) },
        { description: 'Rappi', amount: 27_400, type: 'expense', account: 'bancolombia', categoryId: restaurants, date: monthDay(-1, 20) },
        { description: 'Claro celular', amount: 49_900, type: 'expense', account: 'bancolombia', categoryId: phone, date: monthDay(-1, 22) },
        { description: 'Almuerzo', amount: 16_500, type: 'expense', account: 'efectivo', categoryId: restaurants, date: monthDay(-1, 25) },

        // --- Mes actual ---
        { description: 'Arriendo', amount: 1_200_000, type: 'expense', account: 'bancolombia', categoryId: housing, date: monthDay(0, 2) },
        { description: 'Éxito', amount: 154_200, type: 'expense', account: 'bancolombia', categoryId: supermarket, date: monthDay(0, 5) },
        { description: 'Didi', amount: 14_800, type: 'expense', account: 'bancolombia', categoryId: transportPrivate, date: monthDay(0, 7) },
        { description: 'Crepes & Waffles', amount: 62_000, type: 'expense', account: 'bancolombia', categoryId: restaurants, date: monthDay(0, 9) },
        { description: 'Bodytech', amount: 89_900, type: 'expense', account: 'bancolombia', categoryId: sport, date: monthDay(0, 11) },
        { description: 'Cruz Verde', amount: 41_300, type: 'expense', account: 'bancolombia', categoryId: pharmacy, date: monthDay(0, 13) },
        { description: 'Spotify', amount: 16_900, type: 'expense', account: 'bancolombia', categoryId: subscriptions, date: monthDay(0, 14) },
        { description: 'Bus', amount: 2_900, type: 'expense', account: 'efectivo', categoryId: transportPublic, date: monthDay(0, 17) },
        { description: 'Reembolso mercado', amount: 45_000, type: 'income', account: 'bancolombia', categoryId: refunds, date: monthDay(0, 18) },
        {
            description: 'Pago varios',
            amount: 35_000,
            type: 'expense',
            account: 'bancolombia',
            categoryId: otherExpense,
            date: monthDay(0, 19),
            isAmbiguous: true,
            aiConfidence: 0.42,
            needsReview: true,
        },
        // Sin categoría: aparece como "Sin Categoría". El categorizador en vivo
        // es una transacción NUEVA ("Uber al jardín"), no esta.
        { description: 'Compra en D1', amount: 28_700, type: 'expense', account: 'bancolombia', categoryId: '', date: monthDay(0, 20) },
    ];

    let bancolombia = BANCOLOMBIA_OPENING;
    let efectivo = EFECTIVO_OPENING;

    const transactions: Transaction[] = drafts.map((draft) => {
        if (draft.account === 'bancolombia') {
            bancolombia += draft.type === 'income' ? draft.amount : -draft.amount;
        } else {
            efectivo += draft.type === 'income' ? draft.amount : -draft.amount;
        }

        return {
            id: uuidv4(),
            type: draft.type,
            amount: draft.amount,
            description: draft.description,
            date: draft.date,
            categoryId: draft.categoryId,
            tagIds: [],
            accountId: '', // filled after accounts exist
            createdAt: now,
            updatedAt: now,
            isAmbiguous: draft.isAmbiguous,
            aiConfidence: draft.aiConfidence,
            needsReview: draft.needsReview,
        };
    });

    await db.transaction(
        'rw',
        db.transactions,
        db.accounts,
        db.reserves,
        db.reconciliations,
        db.categories,
        async () => {
            await db.transactions.clear();
            await db.reserves.clear();
            await db.reconciliations.clear();

            const existing = await db.accounts.toArray();
            let bancolombiaId =
                existing.find((a) => a.name.trim().toLowerCase() === 'bancolombia')?.id;
            let efectivoId =
                existing.find((a) => a.name.trim().toLowerCase() === 'efectivo')?.id;

            const extras = existing.filter(
                (a) => a.id !== bancolombiaId && a.id !== efectivoId
            );
            if (extras.length > 0) {
                await db.accounts.bulkDelete(extras.map((a) => a.id));
            }

            if (bancolombiaId) {
                await db.accounts.where('id').equals(bancolombiaId).modify((account) => {
                    account.name = 'Bancolombia';
                    account.type = 'bank';
                    account.calculatedBalance = bancolombia;
                    delete account.actualBalance;
                    delete account.lastReconciliationDate;
                    account.currency = 'COP';
                    account.isActive = true;
                });
            } else {
                bancolombiaId = uuidv4();
                await db.accounts.add({
                    id: bancolombiaId,
                    name: 'Bancolombia',
                    type: 'bank',
                    calculatedBalance: bancolombia,
                    currency: 'COP',
                    isActive: true,
                });
            }

            if (efectivoId) {
                await db.accounts.where('id').equals(efectivoId).modify((account) => {
                    account.name = 'Efectivo';
                    account.type = 'cash';
                    account.calculatedBalance = efectivo;
                    delete account.actualBalance;
                    delete account.lastReconciliationDate;
                    account.currency = 'COP';
                    account.isActive = true;
                });
            } else {
                efectivoId = uuidv4();
                await db.accounts.add({
                    id: efectivoId,
                    name: 'Efectivo',
                    type: 'cash',
                    calculatedBalance: efectivo,
                    currency: 'COP',
                    isActive: true,
                });
            }

            const withAccounts = transactions.map((tx, i) => ({
                ...tx,
                accountId: drafts[i].account === 'bancolombia' ? bancolombiaId! : efectivoId!,
            }));
            await db.transactions.bulkAdd(withAccounts);

            await db.reserves.add({
                id: uuidv4(),
                accountId: bancolombiaId!,
                amount: RESERVE_AMOUNT,
                description: 'Factura de servicios',
                isActive: true,
                createdAt: now,
                updatedAt: now,
            });

            await removeSofiaTransportForLiveDemo();
        }
    );

    const result: DemoSeedResult = {
        bancolombiaCalculated: bancolombia,
        bancolombiaDeclaredOnCamera: bancolombia + RECONCILE_GAP_COP,
        efectivoCalculated: efectivo,
    };

    console.info(
        [
            '[demo] Seed de marketing listo (solo localhost).',
            `Bancolombia calculado: ${formatCurrency(result.bancolombiaCalculated)}`,
            `En cámara, en Reconciliar, escribe: ${formatCurrency(result.bancolombiaDeclaredOnCamera)}`,
            `(eso es calculado + ${formatCurrency(RECONCILE_GAP_COP)})`,
            `Efectivo calculado: ${formatCurrency(result.efectivoCalculated)}`,
            'Reserva activa: Factura de servicios 400.000 en Bancolombia.',
            'NO hay "Uber al jardín": esa transacción se escribe en vivo.',
            'Para regrabar: Ajustes → Reset total → recargar → sembrar de nuevo.',
        ].join('\n')
    );

    return result;
}
