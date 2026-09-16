import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeminiKeyCard } from '@/components/settings/GeminiKeyCard';
import { getAiApiKey, getSelectedAiProvider, setAiApiKey, setSelectedAiProvider } from '@/lib/ai/gateway/config';

describe('GeminiKeyCard / Multi-Provider AI Settings', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('renders provider tabs and defaults to Gemini', () => {
        render(<GeminiKeyCard />);

        expect(screen.getByText('Motor de Inteligencia Artificial')).toBeInTheDocument();
        expect(screen.getByTestId('ai-provider-select-gemini')).toBeInTheDocument();
        expect(screen.getByTestId('ai-provider-select-groq')).toBeInTheDocument();

        expect(screen.getAllByText('Google Gemini').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByTestId('gemini-api-key-input')).toBeInTheDocument();
    });

    it('switches provider to Groq when clicked', async () => {
        render(<GeminiKeyCard />);

        const groqTab = screen.getByTestId('ai-provider-select-groq');
        fireEvent.click(groqTab);

        expect(getSelectedAiProvider()).toBe('groq');
        expect(screen.getAllByText('Groq Cloud').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByPlaceholderText(/gsk_/i)).toBeInTheDocument();
    });

    it('saves key for selected provider', async () => {
        render(<GeminiKeyCard />);

        // Switch to Groq
        fireEvent.click(screen.getByTestId('ai-provider-select-groq'));

        const input = screen.getByTestId('gemini-api-key-input');
        fireEvent.change(input, { target: { value: 'gsk_testkey_123456789' } });

        const saveBtn = screen.getByTestId('gemini-api-key-save');
        fireEvent.click(saveBtn);

        expect(getAiApiKey('groq')).toBe('gsk_testkey_123456789');
        expect(screen.getByText(/API Key activa para Groq Cloud/i)).toBeInTheDocument();
    });

    it('shows masked key when key already exists', () => {
        setAiApiKey('gemini', 'AIzaSyFakeKey1234567890');
        setSelectedAiProvider('gemini');

        render(<GeminiKeyCard />);

        expect(screen.getByText(/AIza…7890/)).toBeInTheDocument();
        expect(screen.getByTestId('gemini-api-key-replace')).toBeInTheDocument();
        expect(screen.getByTestId('gemini-api-key-forget')).toBeInTheDocument();
    });

    it('forgets API key when Olvidar is clicked', () => {
        setAiApiKey('gemini', 'AIzaSyFakeKey1234567890');
        setSelectedAiProvider('gemini');

        render(<GeminiKeyCard />);

        const forgetBtn = screen.getByTestId('gemini-api-key-forget');
        fireEvent.click(forgetBtn);

        expect(getAiApiKey('gemini')).toBeNull();
        expect(screen.getByTestId('gemini-api-key-input')).toBeInTheDocument();
    });
});
