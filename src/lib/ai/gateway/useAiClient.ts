import { useCallback, useState } from 'react';
import type { AiProviderType } from '../types';
import {
    clearAiApiKey,
    getAiApiKey,
    getSelectedAiProvider,
    hasAiApiKey,
    maskApiKey,
    setAiApiKey,
    setSelectedAiProvider,
} from './config';
import { createAiClient } from './factory';
import { executeAiPrompt, type OrchestrateAiOptions } from './orchestrator';
import type { AiGenerateResult, ConnectionTestResult } from './types';

export function useAiClient() {
    const [provider, setProviderState] = useState<AiProviderType>(getSelectedAiProvider());
    const [apiKey, setApiKeyState] = useState<string | null>(getAiApiKey(provider));

    const updateProvider = useCallback((newProvider: AiProviderType) => {
        setSelectedAiProvider(newProvider);
        setProviderState(newProvider);
        setApiKeyState(getAiApiKey(newProvider));
    }, []);

    const updateApiKey = useCallback((providerTarget: AiProviderType, key: string) => {
        setAiApiKey(providerTarget, key);
        if (providerTarget === provider) {
            setApiKeyState(key.trim() || null);
        }
    }, [provider]);

    const removeApiKey = useCallback((providerTarget: AiProviderType) => {
        clearAiApiKey(providerTarget);
        if (providerTarget === provider) {
            setApiKeyState(null);
        }
    }, [provider]);

    const generate = useCallback(
        async (businessPrompt: string, options?: OrchestrateAiOptions): Promise<AiGenerateResult> => {
            return executeAiPrompt(businessPrompt, {
                provider,
                apiKey: apiKey ?? undefined,
                ...options,
            });
        },
        [provider, apiKey]
    );

    const testConnection = useCallback(
        async (targetProvider?: AiProviderType, targetKey?: string): Promise<ConnectionTestResult> => {
            const effectiveProvider = targetProvider ?? provider;
            const effectiveKey = targetKey ?? apiKey ?? getAiApiKey(effectiveProvider);

            if (!effectiveKey) {
                return {
                    ok: false,
                    message: `No hay API key configurada para ${effectiveProvider}`,
                };
            }

            try {
                const client = createAiClient(effectiveProvider, effectiveKey);
                return await client.testConnection();
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Error desconocido';
                return {
                    ok: false,
                    message: `Fallo al probar la conexión con ${effectiveProvider}: ${msg}`,
                };
            }
        },
        [provider, apiKey]
    );

    return {
        provider,
        apiKey,
        hasKey: hasAiApiKey(provider),
        maskedKey: apiKey ? maskApiKey(apiKey) : '',
        setProvider: updateProvider,
        setApiKey: updateApiKey,
        clearApiKey: removeApiKey,
        generate,
        testConnection,
    };
}
