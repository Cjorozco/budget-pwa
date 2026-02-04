import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEsc);
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className={cn(
                "relative w-full max-w-lg transform rounded-2xl bg-white dark:bg-slate-900 shadow-xl transition-all flex flex-col max-h-[90vh]",
                "animate-in fade-in zoom-in-95 duration-200"
            )}>
                <div className="flex items-center justify-between p-6 pb-2">
                    <h2 className="text-xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100">
                        {title}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                        <X size={18} />
                    </Button>
                </div>

                <div className="p-6 pt-2 overflow-y-auto overflow-x-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}
