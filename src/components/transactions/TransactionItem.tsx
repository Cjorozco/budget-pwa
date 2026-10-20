import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface TransactionItemProps {
    title: string;
    /** Date line, shown in the info color (e.g. "30 Apr, 2026 • Bancolombia"). */
    subtitle: string;
    categoryLabel: string;
    /** Always positive; the sign comes from `direction`. */
    amount: number;
    direction: 'in' | 'out';
    /** Category color (user data, not a design token). */
    iconColor: string;
    icon: ReactNode;
    /** Tags under the date (review, adjustment, transfer). */
    badges?: ReactNode;
    /** Trailing controls (edit, delete). Kept as a slot: the item has no business logic. */
    actions?: ReactNode;
    /** Position in the list; staggers the entrance (capped so long lists don't wait). */
    index?: number;
}

export function TransactionItem({
    title,
    subtitle,
    categoryLabel,
    amount,
    direction,
    iconColor,
    icon,
    badges,
    actions,
    index = 0,
}: TransactionItemProps) {
    return (
        <motion.li
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut', delay: Math.min(index, 8) * 0.04 }}
            className="font-brand flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-transparent bg-surface p-3 text-text transition-colors hover:border-accent has-[:focus-visible]:border-info has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info"
            data-testid="transaction-item"
        >
            <div
                className="flex size-12 shrink-0 items-center justify-center rounded-tile text-lg font-bold text-white"
                style={{ backgroundColor: iconColor }}
                aria-hidden="true"
            >
                {icon}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium">{title}</p>
                <p className="text-xs font-semibold text-info">{subtitle}</p>
                {badges && <div className="mt-1.5 flex flex-wrap gap-1">{badges}</div>}
            </div>

            {/* sm+: category in its own column, as in the kit. Below: it sits under the amount. */}
            <div className="hidden max-w-44 items-center self-stretch border-l border-accent pl-3 text-caption font-light text-text-muted sm:flex">
                <span className="truncate">{categoryLabel}</span>
            </div>

            <div className="flex flex-col items-end sm:flex-row sm:items-center sm:self-stretch sm:border-l sm:border-accent sm:pl-3">
                <p
                    className={cn(
                        'text-body font-semibold whitespace-nowrap',
                        direction === 'in' ? 'text-income' : 'text-expense'
                    )}
                >
                    {direction === 'in' ? '+' : '-'}
                    {formatCurrency(amount)}
                </p>
                <p className="max-w-24 truncate text-caption font-light text-text-muted sm:hidden">{categoryLabel}</p>
            </div>

            {actions && <div className="flex w-full justify-end gap-1 sm:w-auto sm:shrink-0">{actions}</div>}
        </motion.li>
    );
}

/** Loading placeholder with the same footprint as `TransactionItem`. */
export function TransactionItemSkeleton() {
    const { t } = useTranslation();

    return (
        <li
            aria-busy="true"
            className="flex items-center gap-3 rounded-2xl bg-surface p-3 motion-safe:animate-pulse"
        >
            <span className="sr-only">{t.common.loading}</span>
            <div className="size-12 shrink-0 rounded-tile bg-surface-raised" />
            <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded-full bg-surface-raised" />
                <div className="h-3 w-1/3 rounded-full bg-surface-raised" />
            </div>
            <div className="h-4 w-16 rounded-full bg-surface-raised" />
        </li>
    );
}

/** Empty list message. The copy is passed in because it depends on the active filter. */
export function TransactionsEmpty({ message }: { message: string }) {
    return (
        <div className="font-brand whitespace-pre-line rounded-2xl bg-surface-raised px-4 py-10 text-center text-sm text-text-muted">
            {message}
        </div>
    );
}
