import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { hasDemoData } from '@/lib/db/demoMode';
import { useTranslation } from '@/lib/i18n';

/** Slim notice shown while sample data is present. */
export function DemoBanner() {
    const { t } = useTranslation();
    const active = useLiveQuery(() => hasDemoData());

    if (!active) return null;

    return (
        <div
            role="status"
            className="flex items-center justify-between gap-3 px-4 py-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800"
            data-testid="demo-banner"
        >
            <span>{t.demo.bannerText}</span>
            <Link to="/settings" className="font-semibold underline underline-offset-2 py-2 px-1">
                {t.demo.bannerAction}
            </Link>
        </div>
    );
}
