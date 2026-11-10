import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Coffee, ExternalLink, X } from 'lucide-react';
import { db } from '@/lib/db';
import { hasDemoData } from '@/lib/db/demoMode';
import { useTranslation } from '@/lib/i18n';
import { SUPPORT_MIN_TRANSACTIONS, SUPPORT_URL, dismissSupportCard, isSupportCardDismissed } from '@/lib/support';

interface SupportCardProps {
    /** Checkout link; defaults to the configured one. Empty hides the card. */
    url?: string;
}

/**
 * Quiet, dismissible invitation to support the project. Shown only to people who
 * already use the app with their own data, and never again once dismissed.
 */
export function SupportCard({ url = SUPPORT_URL }: SupportCardProps) {
    const { t } = useTranslation();
    const [dismissed, setDismissed] = useState(isSupportCardDismissed);

    const eligible = useLiveQuery(async () => {
        const [count, demo] = await Promise.all([db.transactions.count(), hasDemoData()]);
        return !demo && count >= SUPPORT_MIN_TRANSACTIONS;
    });

    if (!url || dismissed || !eligible) return null;

    const handleDismiss = () => {
        dismissSupportCard();
        setDismissed(true);
    };

    return (
        <aside
            data-testid="support-card"
            aria-label={t.support.sectionTitle}
            className="relative rounded-2xl border border-slate-200 bg-white p-4 pr-12 dark:border-slate-800 dark:bg-slate-900"
        >
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t.support.dashboardText}</p>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
            >
                <Coffee size={16} aria-hidden="true" />
                {t.support.button}
                <ExternalLink size={14} aria-hidden="true" />
            </a>
            <button
                type="button"
                onClick={handleDismiss}
                aria-label={t.support.dismiss}
                title={t.support.dismiss}
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
                <X size={18} aria-hidden="true" />
            </button>
        </aside>
    );
}
