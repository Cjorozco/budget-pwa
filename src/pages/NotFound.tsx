import { Link } from 'react-router-dom';
import { useTranslation } from '@/lib/i18n';

export default function NotFoundPage() {
    const { t } = useTranslation();

    return (
        <div className="p-4 py-16 text-center space-y-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.common.notFoundTitle}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.common.notFoundBody}</p>
            <Link to="/" className="inline-block text-sm font-medium text-blue-600 dark:text-blue-400 underline">
                {t.common.goHome}
            </Link>
        </div>
    );
}
