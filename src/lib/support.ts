/** Checkout link for the voluntary "buy me a coffee" contribution. It unlocks nothing. */
export const SUPPORT_URL: string | undefined = import.meta.env.VITE_LEMON_CHECKOUT_URL;

/** The dashboard card only shows to people who already use the app. */
export const SUPPORT_MIN_TRANSACTIONS = 10;

export const SUPPORT_CARD_DISMISSED_KEY = 'budget_support_card_dismissed';

export function isSupportCardDismissed(): boolean {
    try {
        return localStorage.getItem(SUPPORT_CARD_DISMISSED_KEY) === '1';
    } catch {
        return false;
    }
}

export function dismissSupportCard(): void {
    try {
        localStorage.setItem(SUPPORT_CARD_DISMISSED_KEY, '1');
    } catch {
        // Storage unavailable (private mode): the card may show again next visit.
    }
}
