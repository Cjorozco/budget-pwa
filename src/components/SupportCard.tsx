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
            className="relative rounded-2xl border border-surface-raised bg-surface p-4 pr-12 text-text"
        >
            <p className="text-sm leading-relaxed text-text-muted">{t.support.dashboardText}</p>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-info underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
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
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-raised hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
            >
                <X size={18} aria-hidden="true" />
            </button>
        </aside>
    );
}
