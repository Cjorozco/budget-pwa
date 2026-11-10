import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { db } from '@/lib/db';
import { useUIStore } from '@/store/ui';
import type { ResolverResult } from '@/lib/ai/types';
import { saveValidatedSuggestion } from '@/lib/ai/suggestionValidation';
import { setAiApiKey, setSelectedAiProvider } from '@/lib/ai/gateway/config';

vi.mock('@/lib/ai/suggestWithLlm', () => ({
    suggestCategoryWithLlm: vi.fn(),
}));

import { suggestCategoryWithLlm } from '@/lib/ai/suggestWithLlm';

async function typeDescription(text: string) {
    const user = userEvent.setup();
    render(<TransactionForm onSuccess={vi.fn()} />);
    await user.type(screen.getByTestId('description-input'), text);
    await user.tab();
}

describe('TransactionForm AI diagnostic notice', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        localStorage.clear();
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

    it('shows no notice when the AI is simply not configured', async () => {
        const result: ResolverResult = { status: 'no-match', aiDiagnosis: { status: 'unavailable', reason: 'no-api-key' } };
        vi.mocked(suggestCategoryWithLlm).mockResolvedValue(result);

        await typeDescription('almuerzo');

        await waitFor(() => expect(suggestCategoryWithLlm).toHaveBeenCalled(), { timeout: 3000 });
        expect(screen.queryByTestId('ai-diagnostic-notice')).not.toBeInTheDocument();
    });

    it('waits through pauses while typing and resolves the completed description after blur', async () => {
        vi.mocked(suggestCategoryWithLlm).mockResolvedValue({ status: 'no-match' });
        const user = userEvent.setup();
        render(<TransactionForm onSuccess={vi.fn()} />);
        await user.type(screen.getByTestId('description-input'), 'pag');
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
        expect(suggestCategoryWithLlm).not.toHaveBeenCalled();

        await user.type(screen.getByTestId('description-input'), 'o de internet');
        await user.tab();
        await waitFor(() => expect(suggestCategoryWithLlm).toHaveBeenCalledOnce());
        expect(suggestCategoryWithLlm).toHaveBeenCalledWith('Pago de internet', 'expense', expect.any(Object));
    });

    it('shows a saved suggestion while typing and skips AI after blur, unless regenerated', async () => {
        setSelectedAiProvider('gemini');
        setAiApiKey('gemini', 'AIzaSyDummyKeyForUnitTests1234567890');
        await saveValidatedSuggestion({
            description: 'pago de internet',
            type: 'expense',
            suggestion: { categoryId: null, categoryPath: 'Servicios › Internet', confidence: 1, reason: 'Validada', needsCategoryCreation: false },
            chosenSource: 'local',
        });
        vi.mocked(suggestCategoryWithLlm).mockResolvedValue({ status: 'no-match' });
        const user = userEvent.setup();
        render(<TransactionForm onSuccess={vi.fn()} />);
        await user.type(screen.getByTestId('description-input'), 'pago de internet');
        expect(await screen.findByTestId('category-suggestion-panel')).toHaveTextContent('Internet');
        await user.tab();
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
        expect(suggestCategoryWithLlm).not.toHaveBeenCalled();

        await user.click(screen.getByTestId('regenerate-suggestion-button'));
        await waitFor(() => expect(suggestCategoryWithLlm).toHaveBeenCalledOnce());
        expect(suggestCategoryWithLlm).toHaveBeenCalledWith('Pago de internet', 'expense', expect.objectContaining({ forceRegenerate: true }));
    });

    it('aborts an outstanding comparison when the user resumes editing and ignores its late response', async () => {
        let finishComparison!: (result: ResolverResult) => void;
        vi.mocked(suggestCategoryWithLlm).mockReturnValue(new Promise(resolve => { finishComparison = resolve; }));
        const user = userEvent.setup();
        render(<TransactionForm onSuccess={vi.fn()} />);
        await user.type(screen.getByTestId('description-input'), 'internet');
        await user.tab();
        await waitFor(() => expect(suggestCategoryWithLlm).toHaveBeenCalledOnce());
        const signal = vi.mocked(suggestCategoryWithLlm).mock.calls[0][2].signal;
        await user.type(screen.getByTestId('description-input'), ' oficina');
        expect(signal?.aborted).toBe(true);
        await act(async () => {
            finishComparison({
                status: 'success', source: 'gemini',
                suggestion: { categoryId: null, categoryPath: 'Respuesta antigua', confidence: 1, reason: 'Anterior', needsCategoryCreation: false },
            });
        });
        expect(screen.queryByText('Respuesta antigua')).not.toBeInTheDocument();
        expect(screen.queryByTestId('ai-pending')).not.toBeInTheDocument();
    });
});
