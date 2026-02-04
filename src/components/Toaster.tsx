import { useUIStore } from '@/store/ui';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

export function Toaster() {
    const { toasts, removeToast } = useUIStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={clsx(
                        "flex items-center gap-3 p-4 rounded-2xl shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300",
                        toast.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400",
                        toast.type === 'error' && "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400",
                        toast.type === 'info' && "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400"
                    )}
                >
                    <div className="shrink-0">
                        {toast.type === 'success' && <CheckCircle size={18} />}
                        {toast.type === 'error' && <AlertCircle size={18} />}
                        {toast.type === 'info' && <Info size={18} />}
                    </div>
                    <p className="text-sm font-medium flex-1">{toast.message}</p>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-current/50"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
}
