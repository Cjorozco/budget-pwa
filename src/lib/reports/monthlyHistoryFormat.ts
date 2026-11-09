import { format, parse, type Locale } from 'date-fns';
import type { TranslationSchema } from '@/lib/i18n/types';
import { toMinorUnits } from '@/lib/money';
import type { BudgetItem } from '@/lib/types';
import type { CategoryAggregate } from './monthlyMetrics';
import type { CategoryMetrics, MedianTrends, TotalMetrics, Trend } from './medianTrends';
import type { HistoryMonth, MonthlyHistory, SeriesStats } from './monthlyHistory';

/** Single-month exports keep version 1; the median section defines version 2. */
const SCHEMA_VERSION_SINGLE_MONTH = 1;
const SCHEMA_VERSION_WITH_MEDIANS = 2;
const TREND_NOT_APPLICABLE = 'no aplica';

function medianTrendsJson(section: MedianTrends, money: (amount: number) => number) {
    const trend = (t: Trend | null) => (t ? { cambio: money(t.change), porcentaje: t.percent } : TREND_NOT_APPLICABLE);

    const total = (t: TotalMetrics) => ({
        mediana: money(t.median),
        tendencia: trend(t.trend),
        promedio_referencia: money(t.averageReference),
    });

    const metrics = (c: CategoryMetrics) => ({
        categoria_id: c.categoryId,
        nombre: c.name,
        mediana: money(c.median),
        minimo: money(c.min),
        maximo: money(c.max),
        meses_con_gasto: c.monthsWithRecords,
        tendencia: trend(c.trend),
        atipico: c.outlier,
    });

    const category = (c: CategoryMetrics) => ({ ...metrics(c), subcategorias: c.subcategories.map(metrics) });

    const { period, totals, outlierMonths, adjustments, categories } = section;

    return {
        periodo: {
            desde: period.from,
            hasta: period.to,
            meses: period.months,
            meses_usados: period.monthsUsed,
            meses_objetivo: period.targetMonths,
        },
        totales: {
            ingresos: total(totals.income),
            gastos: total(totals.expense),
            neto: total(totals.net),
            gastos_sin_atipicos: {
                mediana: totals.expenseWithoutOutliers.median === null ? null : money(totals.expenseWithoutOutliers.median),
                meses_usados: totals.expenseWithoutOutliers.monthsUsed,
            },
        },
        meses_atipicos: outlierMonths.map((m) => ({
            mes: m.month,
            gastos: money(m.expense),
            categorias_responsables: m.categories.map((c) => ({
                categoria_id: c.categoryId,
                nombre: c.name,
                monto: money(c.amount),
                mediana: money(c.median),
            })),
        })),
        ajustes: { ingresos: money(adjustments.income), gastos: money(adjustments.expense) },
        categorias: { gastos: categories.expense.map(category), ingresos: categories.income.map(category) },
        nota_metodo: {
            periodo: `Últimos ${period.targetMonths} meses completos del historial exportado, sin el mes en curso. Meses usados: ${period.monthsUsed} (${period.months.join(', ')}).`,
            atipico: 'El máximo supera 2 veces la mediana y la diferencia es mayor a una mediana. Con mediana 0, cualquier registro cuenta como atípico. Se lista cada mes en que una categoría supere ese umbral.',
            tendencia: `Mediana de los últimos 3 meses contra la de los 3 meses anteriores. Es "${TREND_NOT_APPLICABLE}" si alguna es 0 o si hay menos de 6 meses.`,
            promedio: 'Solo referencia secundaria: se distorsiona por valores atípicos.',
        },
    };
}

/** Stable, machine-readable output: amounts are whole minor units declared in `currency`. */
export function toHistoryJson(history: MonthlyHistory): string {
    const money = (amount: number) => toMinorUnits(amount, history.currency.minorUnitDigits);

    const stats = (series: SeriesStats | null) =>
        series && {
            average: money(series.average),
            median: money(series.median),
            min: money(series.min),
            max: money(series.max),
        };

    const category = (item: CategoryAggregate) => ({
        categoryId: item.categoryId,
        name: item.name,
        amount: money(item.amount),
        percentage: Math.round(item.percentage),
    });

    const subcategory = (item: CategoryAggregate) => ({
        ...category(item),
        parentName: item.parentName ?? null,
    });

    const budgetItems = (items: BudgetItem[]) =>
        [...items]
            .sort((a, b) => b.amount - a.amount)
            .map((item) => ({ name: item.name, amount: money(item.amount), categoryId: item.categoryId ?? null }));

    const month = (m: HistoryMonth) => ({
        month: m.month,
        isPartial: m.isPartial,
        daysElapsed: m.daysElapsed,
        daysInMonth: m.daysInMonth,
        hasData: m.hasData,
        totals: { income: money(m.totals.income), expense: money(m.totals.expense), net: money(m.totals.net) },
        adjustments: { income: money(m.adjustments.income), expense: money(m.adjustments.expense) },
        fixedBudget: {
            plannedIncome: money(m.fixedBudget.plannedIncome),
            plannedExpense: money(m.fixedBudget.plannedExpense),
            plannedAvailable: money(m.fixedBudget.plannedAvailable),
            expenseUsedPercent: m.fixedBudget.expenseUsedPercent,
            incomeReceivedPercent: m.fixedBudget.incomeReceivedPercent,
            expenseDifference: money(m.fixedBudget.expenseDifference),
            status: m.fixedBudget.status,
            incomeItems: budgetItems(m.fixedBudget.incomeItems),
            expenseItems: budgetItems(m.fixedBudget.expenseItems),
        },
        expenses: { byCategory: m.expenses.byCategory.map(category), bySubcategory: m.expenses.bySubcategory.map(subcategory) },
        income: { byCategory: m.income.byCategory.map(category), bySubcategory: m.income.bySubcategory.map(subcategory) },
        dataQuality: m.dataQuality,
    });

    return JSON.stringify(
        {
            schemaVersion: history.medianTrends ? SCHEMA_VERSION_WITH_MEDIANS : SCHEMA_VERSION_SINGLE_MONTH,
            range: history.range,
            generatedAt: history.generatedAt.toISOString(),
            currency: history.currency,
            balanceAtExport: {
                total: money(history.balanceAtExport.totalRealBalance),
                reserved: money(history.balanceAtExport.totalReserved),
                available: money(history.balanceAtExport.totalAvailable),
            },
            ...(history.medianTrends
                ? { medianas_y_tendencias: medianTrendsJson(history.medianTrends, money) }
                : {
                    summary: history.summary && {
                        income: stats(history.summary.income),
                        expense: stats(history.summary.expense),
                        expenseByCategory: history.summary.expenseByCategory.map((c) => ({
                            categoryId: c.categoryId,
                            name: c.name,
                            ...stats(c),
                            activeMonths: c.activeMonths,
                        })),
                    },
                }),
            months: history.months.map(month),
            transactions: history.transactions.map((tx) => ({ ...tx, amount: money(tx.amount) })),
        },
        null,
        2
    );
}

export interface HistoryMarkdownOptions {
    labels: TranslationSchema['reports']['historyExport'];
    formatMoney: (amount: number) => string;
    dateLocale: Locale;
}

/** User-typed names must not be able to break a table row. */
function escapeCell(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s*[\r\n]+\s*/g, ' ');
}

function table(headers: string[], rows: string[][], alignFrom = 1): string {
    const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
    const separator = headers.map((_, i) => (i >= alignFrom ? '---:' : '---'));
    return [line(headers), line(separator), ...rows.map(line)].join('\n');
}

/** Fills {placeholders}; a function replacer keeps "$" in user text and amounts literal. */
function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

function medianTrendsMarkdown(
    section: MedianTrends,
    options: HistoryMarkdownOptions,
    monthName: (key: string) => string
): string {
    const { labels, formatMoney } = options;
    const { period, totals, outlierMonths, adjustments, categories } = section;
    const title = `## ${labels.mdTrendsTitle}`;
    if (period.from === null || period.to === null) return `${title}\n\n${labels.mdNoCompleteMonths}`;

    const periodName = period.from === period.to
        ? monthName(period.to)
        : fill(labels.mdRange, { from: monthName(period.from), to: monthName(period.to) });
    const counts = { period: periodName, used: period.monthsUsed, target: period.targetMonths };

    const trendCell = (t: Trend | null) => {
        if (!t) return labels.mdNotApplicable;
        const sign = t.change > 0 ? '+' : '';
        return `${sign}${formatMoney(t.change)} (${sign}${t.percent}%)`;
    };

    const totalRow = (name: string, t: TotalMetrics) => [name, formatMoney(t.median), trendCell(t.trend), formatMoney(t.averageReference)];

    const categoryCells = (name: string, c: CategoryMetrics) => [
        name,
        formatMoney(c.median),
        formatMoney(c.min),
        formatMoney(c.max),
        String(c.monthsWithRecords),
        trendCell(c.trend),
        c.outlier ? labels.mdYes : labels.mdNo,
    ];

    const categoryTable = (items: CategoryMetrics[]) =>
        table(
            [labels.mdCategory, labels.mdMedian, labels.mdMin, labels.mdMax, labels.mdActiveMonths, labels.mdTrend, labels.mdOutlier],
            items.flatMap((c) => [
                categoryCells(escapeCell(c.name), c),
                ...c.subcategories.map((s) => categoryCells(`↳ ${escapeCell(s.name)}`, s)),
            ])
        );

    const { median: cleanMedian, monthsUsed: cleanMonths } = totals.expenseWithoutOutliers;
    const cleanLine = cleanMedian === null
        ? labels.mdExpenseNoOutliersNone
        : fill(labels.mdExpenseNoOutliers, { amount: formatMoney(cleanMedian), count: cleanMonths });

    const outlierBlock = outlierMonths.length === 0
        ? labels.mdNoOutliers
        : table(
            [labels.mdMonth, labels.mdExpense, labels.mdResponsible],
            outlierMonths.map((m) => [
                monthName(m.month),
                formatMoney(m.expense),
                m.categories
                    .map((c) => fill(labels.mdResponsibleDetail, { name: escapeCell(c.name), amount: formatMoney(c.amount), median: formatMoney(c.median) }))
                    .join('; '),
            ]),
            1
        );

    return [
        `${title}\n\n${fill(labels.mdTrendsPeriod, counts)}`,
        `### ${labels.mdTotalsTitle}\n\n${table(
            [labels.mdConcept, labels.mdMedian, labels.mdTrend, labels.mdAverageReference],
            [totalRow(labels.mdIncome, totals.income), totalRow(labels.mdExpense, totals.expense), totalRow(labels.mdNet, totals.net)]
        )}\n\n${cleanLine}\n\n${fill(labels.mdAdjustmentsApart, { income: formatMoney(adjustments.income), expense: formatMoney(adjustments.expense) })}`,
        `### ${labels.mdOutlierMonths}\n\n${outlierBlock}`,
        `### ${labels.mdExpenseByCategory}\n\n${categoryTable(categories.expense)}`,
        `### ${labels.mdIncomeByCategory}\n\n${categoryTable(categories.income)}`,
        `### ${labels.mdMethodTitle}\n\n${[fill(labels.mdMethodPeriod, counts), labels.mdMethodOutlier, labels.mdMethodTrend, labels.mdMethodAverage].map((n) => `- ${n}`).join('\n')}`,
    ].join('\n\n');
}

/** Human-readable summary. Individual movements stay in the JSON to keep it short. */
export function toHistoryMarkdown(history: MonthlyHistory, options: HistoryMarkdownOptions): string {
    const { labels, formatMoney, dateLocale } = options;
    const { from, to } = history.range;

    const monthName = (key: string) => format(parse(key, 'yyyy-MM', history.generatedAt), 'MMMM yyyy', { locale: dateLocale });

    const monthRow = (m: HistoryMonth) => {
        let name = monthName(m.month);
        if (!m.hasData) name += ` ${labels.mdNoData}`;
        else if (m.isPartial) name += ` ${labels.mdPartial}`;
        return [
            name,
            formatMoney(m.totals.income),
            formatMoney(m.totals.expense),
            formatMoney(m.totals.net),
            formatMoney(m.fixedBudget.plannedExpense),
        ];
    };

    const categoryTable = (items: CategoryAggregate[]) =>
        table(
            [labels.mdCategory, labels.mdAmount, labels.mdShare],
            items.map((item) => [escapeCell(item.name), formatMoney(item.amount), `${Math.round(item.percentage)}%`])
        );

    const period = from === to ? monthName(to) : labels.mdRange.replace('{from}', monthName(from)).replace('{to}', monthName(to));
    const generated = labels.mdGenerated
        .replace('{date}', format(history.generatedAt, 'PPP', { locale: dateLocale }))
        .replace('{currency}', history.currency.code);

    const sections: string[] = [
        `# ${labels.mdTitle}: ${period}\n\n${generated}`,
        `## ${labels.mdMonthlySummary}\n\n${table(
            [labels.mdMonth, labels.mdIncome, labels.mdExpense, labels.mdNet, labels.mdPlannedExpense],
            history.months.map(monthRow)
        )}`,
    ];

    if (history.medianTrends) {
        sections.push(medianTrendsMarkdown(history.medianTrends, options, monthName));
    } else if (history.summary?.income && history.summary.expense) {
        const cells = (s: SeriesStats) => [s.average, s.median, s.min, s.max].map((amount) => formatMoney(amount));
        sections.push(
            `## ${fill(labels.mdAverages, { count: history.range.completeMonths })}\n\n${table(
                [labels.mdConcept, labels.mdAverage, labels.mdMedian, labels.mdMin, labels.mdMax],
                [
                    [labels.mdIncome, ...cells(history.summary.income)],
                    [labels.mdExpense, ...cells(history.summary.expense)],
                ]
            )}`
        );
    } else {
        sections.push(`## ${fill(labels.mdAverages, { count: 0 })}\n\n${labels.mdNoCompleteMonths}`);
    }

    if (history.months.length === 1) {
        const [month] = history.months;
        if (month.expenses.byCategory.length > 0) {
            sections.push(`## ${labels.mdExpenseByCategory}\n\n${categoryTable(month.expenses.byCategory)}`);
        }
        if (month.income.byCategory.length > 0) {
            sections.push(`## ${labels.mdIncomeByCategory}\n\n${categoryTable(month.income.byCategory)}`);
        }
    }

    const { totalRealBalance, totalReserved, totalAvailable } = history.balanceAtExport;
    sections.push(
        `## ${labels.mdBalance}\n\n${table(
            [labels.mdConcept, labels.mdAmount],
            [
                [labels.mdTotalBalance, formatMoney(totalRealBalance)],
                [labels.mdReserved, formatMoney(totalReserved)],
                [labels.mdAvailable, formatMoney(totalAvailable)],
            ]
        )}`
    );

    const sumOf = (pick: (m: HistoryMonth) => number) => history.months.reduce((acc, m) => acc + pick(m), 0);
    const adjustmentIncome = sumOf((m) => m.adjustments.income);
    const adjustmentExpense = sumOf((m) => m.adjustments.expense);
    const pending = sumOf((m) => m.dataQuality.pendingReviewCount);
    const demo = sumOf((m) => m.dataQuality.demoTransactionCount);

    const notes = [labels.noteBalance];
    if (history.months.some((m) => m.isPartial)) {
        notes.push(history.medianTrends ? labels.notePartialMedians : labels.notePartial);
    }
    if (adjustmentIncome > 0 || adjustmentExpense > 0) {
        notes.push(
            (history.medianTrends ? labels.noteAdjustmentsMedians : labels.noteAdjustments)
                .replace('{income}', formatMoney(adjustmentIncome))
                .replace('{expense}', formatMoney(adjustmentExpense))
        );
    }
    if (pending > 0) notes.push(labels.notePending.replace('{count}', String(pending)));
    if (demo > 0) notes.push(labels.noteDemo.replace('{count}', String(demo)));
    notes.push(labels.noteDetail);

    sections.push(`## ${labels.mdNotes}\n\n${notes.map((n) => `- ${n}`).join('\n')}`);

    return `${sections.join('\n\n')}\n`;
}
