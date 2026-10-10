/**
 * Pure builder for the demo dataset (no DB access).
 *
 * Every row id starts with DEMO_ID_PREFIX. That prefix is the only marker the
 * app needs to find and remove demo data without touching user data.
 *
 * Balances are never hard-coded: accounts start from an explicit opening-balance
 * income, so each balance is the derived sum of its transaction history.
 */
import type { SupportedLanguage } from '../i18n/types';
import { getTranslationDictionary } from '../i18n';
import { getRegion } from '../region/regionStore';
import type { Account, BudgetItem, QuickTemplate, Transaction } from '../types';

export const DEMO_ID_PREFIX = 'demo-';

/** Demo history spans this many days back from "today" (inclusive of today). */
const WINDOW_DAYS = 88;
/** Opening balances are dated just before the window so they precede all activity. */
const OPENING_DAYS_AGO = WINDOW_DAYS + 3;

export type DemoCategoryKey =
    | 'supermarket' | 'restaurants' | 'subscriptions' | 'clothes'
    | 'rideHailing' | 'publicTransport'
    | 'rent' | 'electricity' | 'internet' | 'phone'
    | 'pharmacy' | 'cinema' | 'sport'
    | 'salary' | 'interest' | 'freelance' | 'refund' | 'otherIncome';

/**
 * Paths into the default category catalog (see seed.ts). They are resolved with
 * findOrCreateCategory, so demo data reuses the user's categories.
 */
export const DEMO_CATEGORY_PATHS: Record<DemoCategoryKey, { type: 'income' | 'expense'; parent: string; sub: string }> = {
    supermarket: { type: 'expense', parent: 'Gastos diarios', sub: 'Supermercado' },
    restaurants: { type: 'expense', parent: 'Gastos diarios', sub: 'Restaurantes' },
    subscriptions: { type: 'expense', parent: 'Gastos diarios', sub: 'Suscripciones' },
    clothes: { type: 'expense', parent: 'Gastos diarios', sub: 'Ropa' },
    rideHailing: { type: 'expense', parent: 'Transporte', sub: 'Privado' },
    publicTransport: { type: 'expense', parent: 'Transporte', sub: 'Transporte público' },
    rent: { type: 'expense', parent: 'Vivienda', sub: 'Alquiler o hipoteca' },
    electricity: { type: 'expense', parent: 'Servicios básicos', sub: 'Electricidad' },
    internet: { type: 'expense', parent: 'Servicios básicos', sub: 'Cable/Internet' },
    phone: { type: 'expense', parent: 'Servicios básicos', sub: 'Teléfono/Celular' },
    pharmacy: { type: 'expense', parent: 'Salud/médicos', sub: 'Farmacia' },
    cinema: { type: 'expense', parent: 'Ocio', sub: 'Cine' },
    sport: { type: 'expense', parent: 'Ocio', sub: 'Deporte' },
    salary: { type: 'income', parent: 'Salario', sub: 'Nómina' },
    interest: { type: 'income', parent: 'Otros', sub: 'Ingresos por intereses' },
    freelance: { type: 'income', parent: 'Freelance', sub: 'Proyectos' },
    refund: { type: 'income', parent: 'Otros', sub: 'Reembolsos' },
    otherIncome: { type: 'income', parent: 'Otros', sub: 'Otros' },
};

export interface DemoDataset {
    accounts: Account[];
    transactions: Transaction[];
    budgetItems: BudgetItem[];
    quickTemplates: QuickTemplate[];
}

type Labels = Record<SupportedLanguage, string>;
const l = (es: string, en: string, fr: string): Labels => ({ es, en, fr });
const same = (text: string): Labels => l(text, text, text);

type AccountKey = 'payroll' | 'savings' | 'cash';

// Names must differ from the default accounts ("Efectivo", "Bancolombia"):
// seed.ts deduplicates accounts by normalized name on every startup.
const ACCOUNTS: Record<AccountKey, { name: Labels; type: Account['type']; opening: number }> = {
    payroll: { name: l('Cuenta de nómina', 'Payroll account', 'Compte salaire'), type: 'bank', opening: 900_000 },
    savings: { name: l('Ahorros', 'Savings', 'Épargne'), type: 'bank', opening: 1_500_000 },
    cash: { name: l('Efectivo de bolsillo', 'Pocket cash', 'Espèces de poche'), type: 'cash', opening: 80_000 },
};

const accountId = (key: AccountKey) => `${DEMO_ID_PREFIX}acc-${key}`;

interface RecurringEntry {
    key: string;
    /** Day of month, clamped to the month's final day. */
    day: number;
    account: AccountKey;
    type: 'income' | 'expense';
    category: DemoCategoryKey;
    amount: number;
    /** Added per (month % 3) so bills are not identical every month. */
    step?: number;
    description: Labels;
}

const RECURRING: RecurringEntry[] = [
    { key: 'salary', day: 1, account: 'payroll', type: 'income', category: 'salary', amount: 3_800_000, description: l('Nómina', 'Payroll', 'Salaire') },
    { key: 'rent', day: 5, account: 'payroll', type: 'expense', category: 'rent', amount: 1_200_000, description: l('Arriendo', 'Rent', 'Loyer') },
    { key: 'power', day: 12, account: 'payroll', type: 'expense', category: 'electricity', amount: 148_000, step: 12_500, description: same('Enel') },
    { key: 'internet', day: 18, account: 'payroll', type: 'expense', category: 'internet', amount: 119_900, description: same('Claro Hogar') },
    { key: 'phone', day: 20, account: 'payroll', type: 'expense', category: 'phone', amount: 49_900, description: same('Movistar') },
    { key: 'netflix', day: 8, account: 'payroll', type: 'expense', category: 'subscriptions', amount: 44_900, description: same('Netflix') },
    { key: 'spotify', day: 10, account: 'payroll', type: 'expense', category: 'subscriptions', amount: 16_900, description: same('Spotify') },
    { key: 'gym', day: 3, account: 'payroll', type: 'expense', category: 'sport', amount: 89_900, description: same('Bodytech') },
    { key: 'interest', day: 28, account: 'savings', type: 'income', category: 'interest', amount: 14_200, step: 900, description: l('Rendimientos', 'Interest earned', 'Intérêts perçus') },
];

interface VariableEntry {
    daysAgo: number;
    description: Labels;
    amount: number;
    account: AccountKey;
    type?: 'income';
    category: DemoCategoryKey;
}

const corner = l('Tienda de barrio', 'Corner store', 'Épicerie du coin');
const setLunch = l('Almuerzo corriente', 'Set lunch', 'Menu du jour');

const v = (
    daysAgo: number,
    description: Labels | string,
    amount: number,
    account: AccountKey,
    category: DemoCategoryKey,
    type?: 'income',
): VariableEntry => ({
    daysAgo,
    description: typeof description === 'string' ? same(description) : description,
    amount,
    account,
    category,
    type,
});

const VARIABLE: VariableEntry[] = [
    v(1, 'Éxito', 142_300, 'payroll', 'supermarket'),
    v(2, 'Uber', 18_400, 'payroll', 'rideHailing'),
    v(3, 'Rappi', 36_800, 'payroll', 'restaurants'),
    v(4, 'Tiendas D1', 48_900, 'payroll', 'supermarket'),
    v(5, 'TransMilenio', 3_200, 'cash', 'publicTransport'),
    v(6, 'Juan Valdez', 22_500, 'payroll', 'restaurants'),
    v(8, 'Farmatodo', 37_800, 'payroll', 'pharmacy'),
    v(9, 'Didi', 14_600, 'payroll', 'rideHailing'),
    v(10, 'Ara', 63_400, 'payroll', 'supermarket'),
    v(11, setLunch, 16_000, 'cash', 'restaurants'),
    v(12, 'Cine Colombia', 36_000, 'payroll', 'cinema'),
    v(14, 'Rappi', 41_200, 'payroll', 'restaurants'),
    v(15, 'Éxito', 218_700, 'payroll', 'supermarket'),
    v(17, 'Uber', 22_900, 'payroll', 'rideHailing'),
    v(18, 'TransMilenio', 3_200, 'cash', 'publicTransport'),
    v(19, 'Crepes & Waffles', 78_500, 'payroll', 'restaurants'),
    v(20, l('Reembolso de la EPS', 'Health insurance refund', 'Remboursement mutuelle'), 85_000, 'payroll', 'refund', 'income'),
    v(21, 'Tiendas D1', 55_100, 'payroll', 'supermarket'),
    v(22, 'Cruz Verde', 29_400, 'payroll', 'pharmacy'),
    v(24, corner, 12_000, 'cash', 'supermarket'),
    v(26, 'Rappi', 33_900, 'payroll', 'restaurants'),
    v(28, 'Éxito', 176_400, 'payroll', 'supermarket'),
    v(30, 'Uber', 16_700, 'payroll', 'rideHailing'),
    v(32, 'Zara', 189_900, 'payroll', 'clothes'),
    v(35, 'Tiendas D1', 42_300, 'payroll', 'supermarket'),
    v(37, setLunch, 17_000, 'cash', 'restaurants'),
    v(38, l('Proyecto freelance', 'Freelance project', 'Projet freelance'), 650_000, 'payroll', 'freelance', 'income'),
    v(40, 'Didi', 19_800, 'payroll', 'rideHailing'),
    v(42, 'Cine Colombia', 34_000, 'payroll', 'cinema'),
    v(45, 'Éxito', 201_500, 'payroll', 'supermarket'),
    v(48, 'Rappi', 45_700, 'payroll', 'restaurants'),
    v(52, 'Farmatodo', 52_600, 'payroll', 'pharmacy'),
    v(55, 'Uber', 21_300, 'payroll', 'rideHailing'),
    v(58, 'Tiendas D1', 51_800, 'payroll', 'supermarket'),
    v(62, 'Éxito', 164_200, 'payroll', 'supermarket'),
    v(66, 'Juan Valdez', 18_900, 'payroll', 'restaurants'),
    v(70, 'TransMilenio', 3_200, 'cash', 'publicTransport'),
    v(75, 'Rappi', 39_400, 'payroll', 'restaurants'),
    v(80, 'Ara', 58_700, 'payroll', 'supermarket'),
    v(84, 'Uber', 24_100, 'payroll', 'rideHailing'),
];

interface TransferEntry {
    key: string;
    day: number;
    from: AccountKey;
    to: AccountKey;
    amount: number;
}

const TRANSFERS: TransferEntry[] = [
    { key: 'save', day: 3, from: 'payroll', to: 'savings', amount: 500_000 },
    { key: 'atm', day: 6, from: 'payroll', to: 'cash', amount: 100_000 },
];

const noon = (year: number, monthIndex: number, day: number) =>
    new Date(year, monthIndex, day, 12, 0, 0, 0).getTime();

const monthKey = (year: number, monthIndex: number) =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

export function buildDemoData(options: {
    now?: Date;
    language: SupportedLanguage;
    categories: Record<DemoCategoryKey, string>;
}): DemoDataset {
    const { language, categories } = options;
    const now = options.now ?? new Date();
    const y0 = now.getFullYear();
    const m0 = now.getMonth();
    const d0 = now.getDate();

    const todayNoon = noon(y0, m0, d0);
    const windowStart = noon(y0, m0, d0 - WINDOW_DAYS);
    const inWindow = (ts: number) => ts >= windowStart && ts <= todayNoon;
    const transferLabel = getTranslationDictionary(language).transactions.transferLabel;

    const transactions: Transaction[] = [];
    const push = (tx: Omit<Transaction, 'tagIds' | 'createdAt' | 'updatedAt'>) =>
        transactions.push({ ...tx, tagIds: [], createdAt: tx.date, updatedAt: tx.date });

    // Opening balances (before the window) so every balance is derived from history.
    const openingDate = noon(y0, m0, d0 - OPENING_DAYS_AGO);
    (Object.keys(ACCOUNTS) as AccountKey[]).forEach((key) => {
        push({
            id: `${DEMO_ID_PREFIX}tx-open-${key}`,
            type: 'income',
            amount: ACCOUNTS[key].opening,
            description: l('Saldo inicial', 'Opening balance', 'Solde initial')[language],
            date: openingDate,
            categoryId: categories.otherIncome,
            accountId: accountId(key),
        });
    });

    // Monthly rows over the 3-4 calendar months touched by the window.
    for (let offset = -3; offset <= 0; offset++) {
        const first = new Date(y0, m0 + offset, 1);
        const year = first.getFullYear();
        const month = first.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const ym = monthKey(year, month);
        const variation = (year * 12 + month) % 3;
        const resolveDay = (day: number) => Math.min(day, lastDay);

        for (const entry of RECURRING) {
            const date = noon(year, month, resolveDay(entry.day));
            if (!inWindow(date)) continue;
            push({
                id: `${DEMO_ID_PREFIX}tx-${entry.key}-${ym}`,
                type: entry.type,
                amount: entry.amount + variation * (entry.step ?? 0),
                description: entry.description[language],
                date,
                categoryId: categories[entry.category],
                accountId: accountId(entry.account),
            });
        }

        for (const t of TRANSFERS) {
            const date = noon(year, month, resolveDay(t.day));
            if (!inWindow(date)) continue;
            const transferId = `${DEMO_ID_PREFIX}transfer-${t.key}-${ym}`;
            const description = `${transferLabel}: ${ACCOUNTS[t.from].name[language]} ➔ ${ACCOUNTS[t.to].name[language]}`;
            const base = { type: 'transfer' as const, amount: t.amount, description, date, transferId };
            push({ ...base, id: `${transferId}-out`, categoryId: 'transfer-out', accountId: accountId(t.from) });
            push({ ...base, id: `${transferId}-in`, categoryId: 'transfer-in', accountId: accountId(t.to) });
        }
    }

    VARIABLE.forEach((entry, index) => {
        push({
            id: `${DEMO_ID_PREFIX}tx-v${String(index + 1).padStart(2, '0')}`,
            type: entry.type ?? 'expense',
            amount: entry.amount,
            description: entry.description[language],
            date: noon(y0, m0, d0 - entry.daysAgo),
            categoryId: categories[entry.category],
            accountId: accountId(entry.account),
        });
    });

    transactions.sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));

    const accounts: Account[] = (Object.keys(ACCOUNTS) as AccountKey[]).map((key) => ({
        id: accountId(key),
        name: ACCOUNTS[key].name[language],
        type: ACCOUNTS[key].type,
        calculatedBalance: transactions
            .filter((tx) => tx.accountId === accountId(key))
            .reduce((sum, tx) => sum + signedAmount(tx), 0),
        currency: getRegion().currency,
        isActive: true,
    }));

    return {
        accounts,
        transactions,
        budgetItems: buildBudget(now, language),
        quickTemplates: buildTemplates(now, language, categories),
    };
}

/** Effect of a transaction on its own account's balance. */
export function signedAmount(tx: Pick<Transaction, 'type' | 'amount' | 'categoryId'>): number {
    if (tx.type === 'income') return tx.amount;
    if (tx.type === 'expense') return -tx.amount;
    return tx.categoryId === 'transfer-in' ? tx.amount : -tx.amount;
}

const BUDGET: Array<{ key: string; type: 'income' | 'expense'; amount: number; name: Labels }> = [
    { key: 'salary', type: 'income', amount: 3_800_000, name: l('Salario', 'Salary', 'Salaire') },
    { key: 'rent', type: 'expense', amount: 1_200_000, name: l('Arriendo', 'Rent', 'Loyer') },
    { key: 'utilities', type: 'expense', amount: 330_000, name: l('Servicios (luz, internet, celular)', 'Utilities (power, internet, phone)', 'Charges (électricité, internet, mobile)') },
    { key: 'groceries', type: 'expense', amount: 750_000, name: l('Mercado', 'Groceries', 'Courses') },
    { key: 'dining', type: 'expense', amount: 300_000, name: l('Restaurantes y domicilios', 'Dining out and delivery', 'Restaurants et livraisons') },
    { key: 'transport', type: 'expense', amount: 120_000, name: l('Transporte', 'Transport', 'Transport') },
    { key: 'subscriptions', type: 'expense', amount: 150_000, name: l('Suscripciones y gimnasio', 'Subscriptions and gym', 'Abonnements et salle de sport') },
    { key: 'health', type: 'expense', amount: 60_000, name: l('Salud y farmacia', 'Health and pharmacy', 'Santé et pharmacie') },
];

function buildBudget(now: Date, language: SupportedLanguage): BudgetItem[] {
    const items: BudgetItem[] = [];
    for (let offset = -2; offset <= 0; offset++) {
        const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const ym = monthKey(first.getFullYear(), first.getMonth());
        const createdAt = noon(first.getFullYear(), first.getMonth(), 1);
        for (const item of BUDGET) {
            items.push({
                id: `${DEMO_ID_PREFIX}budget-${ym}-${item.key}`,
                month: ym,
                name: item.name[language],
                amount: item.amount,
                type: item.type,
                createdAt,
                updatedAt: createdAt,
            });
        }
    }
    return items;
}

function buildTemplates(
    now: Date,
    language: SupportedLanguage,
    categories: Record<DemoCategoryKey, string>,
): QuickTemplate[] {
    const createdAt = now.getTime();
    const base = { createdAt, updatedAt: createdAt };
    return [
        {
            ...base,
            id: `${DEMO_ID_PREFIX}template-rent`,
            name: l('Arriendo', 'Rent', 'Loyer')[language],
            icon: '🏠',
            description: l('Pago mensual del arriendo', 'Monthly rent payment', 'Paiement mensuel du loyer')[language],
            amount: 1_200_000,
            type: 'expense',
            categoryId: categories.rent,
            accountId: accountId('payroll'),
        },
        {
            ...base,
            id: `${DEMO_ID_PREFIX}template-netflix`,
            name: 'Netflix',
            icon: '🎬',
            description: l('Suscripción mensual', 'Monthly subscription', 'Abonnement mensuel')[language],
            amount: 44_900,
            type: 'expense',
            categoryId: categories.subscriptions,
            accountId: accountId('payroll'),
        },
        {
            ...base,
            id: `${DEMO_ID_PREFIX}template-salary`,
            name: l('Nómina', 'Payroll', 'Salaire')[language],
            icon: '💰',
            description: l('Pago mensual de nómina', 'Monthly payroll', 'Salaire mensuel')[language],
            amount: 3_800_000,
            type: 'income',
            categoryId: categories.salary,
            accountId: accountId('payroll'),
        },
    ];
}
