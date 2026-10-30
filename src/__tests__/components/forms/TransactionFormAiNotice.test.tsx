import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { db } from '@/lib/db';
import { useUIStore } from '@/store/ui';
import { useLicenseStore } from '@/store/licenseStore';
import type { ResolverResult } from '@/lib/ai/types';

vi.mock('@/lib/ai/suggestWithLlm', () => ({
    suggestCategoryWithLlm: vi.fn(),
}));

import { suggestCategoryWithLlm } from '@/lib/ai/suggestWithLlm';

async function typeDescription(text: string) {
    const user = userEvent.setup();
    render(<TransactionForm onSuccess={vi.fn()} />);
    await user.type(screen.getByTestId('description-input'), text);
}

describe('TransactionForm AI diagnostic notice', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        localStorage.clear();
        useLicenseStore.setState({ isPro: true });
        useUIStore.setState({ toasts: [] });
        await db.transactions.clear();
        await db.accounts.clear();
        await db.categories.clear();
        await db.reserves.clear();
        await db.suggestionValidations.clear();
        await db.accounts.add({ id: 'acc-1', name: 'Banco', type: 'bank', calculatedBalance: 0, currency: 'COP', isActive: true });
    });

    it('explains an invalid key even when the local engine finds nothing', async () => {
        const result: ResolverResult = { status: 'no-match', aiDiagnosis: { status: 'error', reason: 'http-401' } };
        vi.mocked(suggestCategoryWithLlm).mockResolvedValue(result);

        await typeDescription('almuerzo');

        const notice = await screen.findByTestId('ai-diagnostic-notice', undefined, { timeout: 3000 });
        expect(notice).toHaveTextContent(/API key no es válida/i);
        expect(notice).not.toHaveTextContent(/reglas locales/i);
    });

    it('mentions the local rules when the fallback produced the suggestion', async () => {
        const result: ResolverResult = {
            status: 'success',
            source: 'local',
            suggestion: { categoryId: null, categoryPath: 'Alimentación', confidence: 0.4, reason: 'x', needsCategoryCreation: false },
            aiDiagnosis: { status: 'error', reason: 'http-429' },
        };
        vi.mocked(suggestCategoryWithLlm).mockResolvedValue(result);

        await typeDescription('almuerzo');

        const notice = await screen.findByTestId('ai-diagnostic-notice', undefined, { timeout: 3000 });
        expect(notice).toHaveTextContent(/cuota/i);
        expect(notice).toHaveTextContent(/reglas locales/i);
    });

    it('gates the AI on the real license: no Pro flag in localStorage can unlock it, and a new license applies without reloading', async () => {
        const result: ResolverResult = { status: 'no-match', aiDiagnosis: { status: 'unavailable', reason: 'not-pro' } };
        vi.mocked(suggestCategoryWithLlm).mockResolvedValue(result);
        localStorage.setItem('budget_is_pro', 'true');
        useLicenseStore.setState({ isPro: false });

        const user = userEvent.setup();
        render(<TransactionForm onSuccess={vi.fn()} />);
        await user.type(screen.getByTestId('description-input'), 'almuerzo');
        await waitFor(() => expect(suggestCategoryWithLlm).toHaveBeenCalled(), { timeout: 3000 });
        expect(vi.mocked(suggestCategoryWithLlm).mock.calls.at(-1)?.[2]).toMatchObject({ isPro: false });

        // activating a license while the form is open takes effect on the next suggestion
        vi.mocked(suggestCategoryWithLlm).mockClear();
        useLicenseStore.setState({ isPro: true });
        await user.type(screen.getByTestId('description-input'), ' hoy');
        await waitFor(() => expect(suggestCategoryWithLlm).toHaveBeenCalled(), { timeout: 3000 });
        expect(vi.mocked(suggestCategoryWithLlm).mock.calls.at(-1)?.[2]).toMatchObject({ isPro: true });
    });

    it('shows no notice when the AI is simply not configured', async () => {
        const result: ResolverResult = { status: 'no-match', aiDiagnosis: { status: 'unavailable', reason: 'no-api-key' } };
        vi.mocked(suggestCategoryWithLlm).mockResolvedValue(result);

        await typeDescription('almuerzo');

        await waitFor(() => expect(suggestCategoryWithLlm).toHaveBeenCalled(), { timeout: 3000 });
        expect(screen.queryByTestId('ai-diagnostic-notice')).not.toBeInTheDocument();
    });
});
