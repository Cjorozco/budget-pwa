import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface BalanceSummaryCardProps {
    balance: number;
    /** Always positive; shown with a minus sign. */
    expense: number;
    /** Share of the goal already spent, 0–100. Computed by the caller. */
    spentPercent: number;
    goalAmount: number;
    /** Short status line under the bar (e.g. "30% of your expenses, looks good."). */
    message?: string;
    isLoading?: boolean;
}

export function BalanceSummaryCard({
    balance,
    expense,
    spentPercent,
    goalAmount,
    message,
    isLoading = false,
}: BalanceSummaryCardProps) {
    const { t } = useTranslation();
    const percent = Math.min(100, Math.max(0, Math.round(spentPercent)));

    // Figma paints these numbers honeydew on the green fill (1.93:1). `on-accent` keeps AA contrast.
    if (isLoading) {
        return (
            <section
                role="status"
                aria-label={t.common.loading}
                className="font-brand space-y-4 rounded-card bg-accent p-5 motion-safe:animate-pulse"
            >
                <div className="flex gap-6">
                    <div className="h-12 flex-1 rounded-xl bg-on-accent/20" />
                    <div className="h-12 flex-1 rounded-xl bg-on-accent/20" />
                </div>
                <div className="h-7 rounded-full bg-on-accent/20" />
            </section>
        );
    }

    return (
        <section className="font-brand space-y-4 rounded-card bg-accent p-5 text-on-accent">
            <div className="flex items-center">
                <div className="flex-1">
                    <p className="flex items-center gap-1.5 text-xs">
                        <ArrowUpRight size={12} aria-hidden="true" />
                        {t.transactions.totalBalance}
                    </p>
                    <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
                </div>
                <div className="mx-4 h-10 border-l border-on-accent/30" aria-hidden="true" />
                <div className="flex-1">
                    <p className="flex items-center gap-1.5 text-xs">
                        <ArrowDownRight size={12} aria-hidden="true" />
                        {t.transactions.totalExpense}
                    </p>
                    <p className="text-2xl font-semibold">-{formatCurrency(expense)}</p>
                </div>
            </div>

            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={`${percent}% / ${formatCurrency(goalAmount)}`}
                aria-label={t.transactions.totalExpense}
                className="flex h-7 overflow-hidden rounded-full bg-surface text-xs"
            >
                <div
                    className="flex min-w-14 shrink-0 items-center rounded-full bg-text pl-3 text-surface"
                    style={{ width: `${percent}%` }}
                >
                    {percent}%
                </div>
                {/* Clipped (not overlapped) when the fill reaches it; the full goal is in aria-valuetext. */}
                <div className="flex min-w-0 flex-1 items-center justify-end overflow-hidden whitespace-nowrap pr-3 font-medium italic text-text">
                    {formatCurrency(goalAmount)}
                </div>
            </div>

            {message && <p className="text-body">{message}</p>}
        </section>
    );
}
