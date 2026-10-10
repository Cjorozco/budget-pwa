import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, ArrowRightLeft, Settings, Calculator, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useTranslation } from '@/lib/i18n';
import { DemoBanner } from '@/components/DemoBanner';
import { AppTour } from '@/components/tour/AppTour';

export default function Layout() {
    const location = useLocation();
    const { t } = useTranslation();

    const navItems = [
        { href: '/', icon: LayoutDashboard, label: t.nav.dashboard },
        { href: '/budget', icon: Calculator, label: t.nav.budget },
        { href: '/transactions', icon: ArrowRightLeft, label: t.nav.transactions },
        { href: '/accounts', icon: Wallet, label: t.nav.accounts },
        { href: '/reports', icon: PieChart, label: t.nav.reports },
        { href: '/settings', icon: Settings, label: t.nav.settings },
    ];

    return (
        <div className="flex flex-col min-h-dvh bg-slate-50 dark:bg-slate-950">
            <DemoBanner />
            <main className="flex-1 overflow-y-auto pb-20">
                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 pb-safe pt-2">
                <div className="flex justify-between items-center max-w-md mx-auto h-16">
                    {navItems.map(({ href, icon: Icon, label }) => {
                        const isActive = location.pathname === href;
                        return (
                            <Link
                                key={href}
                                to={href}
                                data-tour={`nav-${href === '/' ? 'dashboard' : href.slice(1)}`}
                                className={cn(
                                    "flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors",
                                    isActive
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                )}
                            >
                                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-medium">{label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
            <AppTour />
        </div>
    );
}
