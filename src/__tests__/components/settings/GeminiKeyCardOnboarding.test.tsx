import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GeminiKeyCard } from '@/components/settings/GeminiKeyCard';
import { clearAiApiKey, getAiApiKey, setAiApiKey, setSelectedAiProvider } from '@/lib/ai/gateway/config';
import { useI18nStore } from '@/lib/i18n/i18nStore';

const VALID_GEMINI_KEY = 'AIzaSyA-valid-looking-key-1234567890abcdef';

const invalidKeyResponse = () =>
    new Response(
        JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } }),
        { status: 400 }
    );

/** Types a value and pastes it, as a user would. */
function pasteKey(value: string) {
    const input = screen.getByTestId('gemini-api-key-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    fireEvent.paste(input);
    return input;
}

describe('GeminiKeyCard onboarding', () => {
    // config.ts keeps an in-memory copy besides localStorage, so clear both between tests.
    const resetAiConfig = () => {
        localStorage.clear();
        for (const provider of ['gemini', 'openai', 'anthropic', 'groq'] as const) clearAiApiKey(provider);
        setSelectedAiProvider('gemini');
    };

    beforeEach(() => {
        resetAiConfig();
        useI18nStore.setState({ language: 'es' });
    });

    afterEach(() => {
        resetAiConfig();
        vi.restoreAllMocks();
    });

    describe('hierarchy and messaging', () => {
        it('tells the user the app works without AI', () => {
            render(<GeminiKeyCard />);
            expect(screen.getByTestId('ai-optional-notice')).toHaveTextContent(/funciona sin IA/i);
        });

        it('recommends only Gemini, with the free / no card / 2 minutes hint', () => {
            render(<GeminiKeyCard />);

            const hints = screen.getAllByTestId('ai-recommended-hint');
            expect(hints).toHaveLength(1);
            expect(hints[0]).toHaveTextContent(/Recomendado/);
            expect(hints[0]).toHaveTextContent(/Gratis, sin tarjeta, 2 minutos/);
            expect(screen.getByTestId('ai-provider-select-gemini')).toContainElement(hints[0]);
        });

        it('puts the paid providers under a collapsed advanced section by default', () => {
            render(<GeminiKeyCard />);

            const advanced = screen.getByTestId('ai-advanced-providers') as HTMLDetailsElement;
            expect(advanced.open).toBe(false);
            expect(advanced).toContainElement(screen.getByTestId('ai-provider-select-openai'));
            expect(advanced).toContainElement(screen.getByTestId('ai-provider-select-anthropic'));
            expect(advanced).not.toContainElement(screen.getByTestId('ai-provider-select-gemini'));
            expect(advanced).not.toContainElement(screen.getByTestId('ai-provider-select-groq'));
        });

        it('opens the advanced section when a paid provider is already selected or has a key', () => {
            setSelectedAiProvider('anthropic');
            const { unmount } = render(<GeminiKeyCard />);
            expect((screen.getByTestId('ai-advanced-providers') as HTMLDetailsElement).open).toBe(true);
            unmount();

            setSelectedAiProvider('gemini');
            setAiApiKey('openai', 'sk-proj-abcdefghijklmnopqrstuvwxyz');
            render(<GeminiKeyCard />);
            expect((screen.getByTestId('ai-advanced-providers') as HTMLDetailsElement).open).toBe(true);
        });

        it('shows the step-by-step guide open until a key exists', () => {
            const { unmount } = render(<GeminiKeyCard />);
            expect((screen.getByTestId('ai-provider-tutorial') as HTMLDetailsElement).open).toBe(true);
            unmount();

            setAiApiKey('gemini', VALID_GEMINI_KEY);
            render(<GeminiKeyCard />);
            expect((screen.getByTestId('ai-provider-tutorial') as HTMLDetailsElement).open).toBe(false);
        });

        it('localizes the onboarding copy', () => {
            useI18nStore.setState({ language: 'en' });
            render(<GeminiKeyCard />);
            expect(screen.getByTestId('ai-optional-notice')).toHaveTextContent(/works without AI/i);
            expect(screen.getByTestId('ai-recommended-hint')).toHaveTextContent(/Free, no card, 2 minutes/);
        });
    });

    describe('key check on paste', () => {
        it('verifies a pasted key without generating text and without saving it', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ models: [] }), { status: 200 }));
            render(<GeminiKeyCard />);

            pasteKey(VALID_GEMINI_KEY);

            await waitFor(() => expect(screen.getByTestId('ai-key-check')).toHaveAttribute('data-status', 'valid'));
            expect(screen.getByTestId('ai-key-check')).toHaveTextContent(/reconoce esta key/i);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(String(fetchSpy.mock.calls[0][0])).toContain('/v1beta/models');
            expect(String(fetchSpy.mock.calls[0][0])).not.toContain('generateContent');
            // verifying never saves: that stays an explicit action
            expect(getAiApiKey('gemini')).toBeNull();
        });

        it('tells the user when the provider rejects the key', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(invalidKeyResponse());
            render(<GeminiKeyCard />);

            pasteKey(VALID_GEMINI_KEY);

            await waitFor(() => expect(screen.getByTestId('ai-key-check')).toHaveAttribute('data-status', 'invalid'));
            expect(screen.getByTestId('ai-key-check')).toHaveTextContent(/no reconoce esta key/i);
        });

        it('says it could not verify (instead of "invalid") when the check fails for network reasons', async () => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
            render(<GeminiKeyCard />);

            pasteKey(VALID_GEMINI_KEY);

            await waitFor(() => expect(screen.getByTestId('ai-key-check')).toHaveAttribute('data-status', 'unknown'));
            expect(screen.getByTestId('ai-key-check')).toHaveTextContent(/No se pudo verificar/i);
            // the key can still be saved
            fireEvent.click(screen.getByTestId('gemini-api-key-save'));
            expect(getAiApiKey('gemini')).toBe(VALID_GEMINI_KEY);
        });

        it('catches a key from the wrong provider by format, without any network call', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch');
            render(<GeminiKeyCard />);

            pasteKey('sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

            await waitFor(() => expect(screen.getByText(/parece una key de Anthropic/i)).toBeInTheDocument());
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(screen.queryByTestId('ai-key-check')).not.toBeInTheDocument();
        });

        it('ignores a slow answer if the user already changed the key', async () => {
            let resolveFetch: (r: Response) => void = () => {};
            vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
            render(<GeminiKeyCard />);

            const input = pasteKey(VALID_GEMINI_KEY);
            await waitFor(() => expect(screen.getByTestId('ai-key-check')).toHaveAttribute('data-status', 'checking'));

            fireEvent.change(input, { target: { value: VALID_GEMINI_KEY + 'x' } });
            resolveFetch(new Response(JSON.stringify({ models: [] }), { status: 200 }));

            await waitFor(() => expect(screen.queryByTestId('ai-key-check')).not.toBeInTheDocument());
        });

        it('checks against the selected provider', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
            render(<GeminiKeyCard />);

            fireEvent.click(screen.getByTestId('ai-provider-select-groq'));
            pasteKey('gsk_abcdefghijklmnopqrstuvwxyz');

            await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
            expect(String(fetchSpy.mock.calls[0][0])).toContain('api.groq.com');
        });

        it('explains in the card that the check is light and the key stays in the browser', () => {
            render(<GeminiKeyCard />);
            expect(screen.getByText(/no gasta cuota de uso/i)).toBeInTheDocument();
        });
    });
});
