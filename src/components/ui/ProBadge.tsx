import { Sparkles, Zap, Flame } from 'lucide-react';
import { useLicenseStore, type Tier } from '../../store/licenseStore';

interface ProBadgeProps {
    tier?: Tier;
    size?: 'sm' | 'md';
    className?: string;
    showUnlockAction?: boolean;
}

export const ProBadge: React.FC<ProBadgeProps> = ({
    tier: propTier,
    size = 'sm',
    className = '',
    showUnlockAction = false,
}) => {
    const { tier: storeTier, themeMode, openUpgradeModal } = useLicenseStore();
    const tier = propTier || storeTier;

    if (tier === 'free' && !showUnlockAction) return null;

    const isDbz = themeMode === 'dbz';

    let label = 'PRO';
    let icon = <Sparkles className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
    let colorClass = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60';

    if (tier === 'god') {
        label = isDbz ? 'SSJ GOD' : 'GOD';
        icon = <Flame className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
        colorClass = 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-600';
    } else if (tier === 'pro') {
        label = isDbz ? 'SSJ1' : 'PRO';
        icon = <Zap className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
        colorClass = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60';
    } else if (showUnlockAction) {
        label = isDbz ? 'DESBLOQUEAR SSJ' : 'PRO';
        icon = <Sparkles className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
        colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 hover:scale-105 transition-transform cursor-pointer';
    }

    const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-1 gap-1.5 font-bold';

    const content = (
        <span
            className={`inline-flex items-center font-semibold rounded-full border shadow-xs ${sizeClasses} ${colorClass} ${className}`}
        >
            {icon}
            <span>{label}</span>
        </span>
    );

    if (showUnlockAction && tier === 'free') {
        return (
            <button
                type="button"
                onClick={() => openUpgradeModal('Desbloquea funcionalidades PRO')}
                className="focus:outline-hidden"
                title="Haz clic para conocer Personal Budget PRO"
            >
                {content}
            </button>
        );
    }

    return content;
};
