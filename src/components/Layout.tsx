import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, ArrowRightLeft, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Layout() {
    const location = useLocation();

    const navItems = [
        { href: '/', icon: LayoutDashboard, label: 'Resumen' },
        { href: '/transactions', icon: ArrowRightLeft, label: 'Movs' },
        { href: '/accounts', icon: Wallet, label: 'Cuentas' },
        { href: '/settings', icon: Settings, label: 'Ajustes' },
    ];

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
            <main className="flex-1 overflow-y-auto pb-20">
                <Outlet />
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 pb-safe pt-2">
                <div className="flex justify-between items-center max-w-md mx-auto h-16">
                    {navItems.map(({ href, icon: Icon, label }) => {
                        const isActive = location.pathname === href;
                        return (
                            <Link
                                key={href}
                                to={href}
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
        </div>
    );
}
