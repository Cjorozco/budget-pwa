import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

export interface ConfirmDialogOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
}

interface ActiveConfirmDialog extends ConfirmDialogOptions {
    resolve: (value: boolean) => void;
}

interface UIState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    toasts: Toast[];
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;
    confirmDialog: ActiveConfirmDialog | null;
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
    closeConfirmDialog: (result: boolean) => void;
    isPro: boolean;
    unlockPro: () => void;
}

const getInitialIsPro = () => {
    try {
        return localStorage.getItem('budget_is_pro') === 'true';
    } catch {
        return false;
    }
};

export const useUIStore = create<UIState>((set) => ({
    isPro: getInitialIsPro(),
    unlockPro: () => {
        try {
            localStorage.setItem('budget_is_pro', 'true');
        } catch (e) {}
        set({ isPro: true });
    },
    isSidebarOpen: false,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    toasts: [],
    addToast: (message, type = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { id, message, type }]
        }));
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id)
            }));
        }, 3000);
    },
    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
    })),
    confirmDialog: null,
    confirm: (options) => {
        return new Promise<boolean>((resolve) => {
            set({
                confirmDialog: {
                    ...options,
                    resolve,
                }
            });
        });
    },
    closeConfirmDialog: (result) => {
        set((state) => {
            if (state.confirmDialog) {
                state.confirmDialog.resolve(result);
            }
            return { confirmDialog: null };
        });
    },
}));

