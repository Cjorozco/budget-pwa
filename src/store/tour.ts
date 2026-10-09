import { create } from 'zustand';

export const TOUR_DONE_KEY = 'budget_tour_done';

function readDone(): boolean {
    try {
        return localStorage.getItem(TOUR_DONE_KEY) === '1';
    } catch {
        return false;
    }
}

interface TourState {
    isOpen: boolean;
    /** True once the user finished or skipped the tour at least once. */
    isDone: boolean;
    /** Opens the tour from step 1 (also used to replay it from Settings). */
    start: () => void;
    /** Closes the tour and remembers it so it never auto-opens again. */
    finish: () => void;
}

export const useTourStore = create<TourState>((set) => ({
    isOpen: false,
    isDone: readDone(),
    start: () => set({ isOpen: true }),
    finish: () => {
        try {
            localStorage.setItem(TOUR_DONE_KEY, '1');
        } catch {
            // Storage unavailable (private mode): the tour may auto-open again next visit.
        }
        set({ isOpen: false, isDone: true });
    },
}));
