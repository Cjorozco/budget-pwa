import { useState } from 'react';
import { ExternalLink, KeyRound, Sparkles, Trash2, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    getAiApiKey,
    getProviderMeta,
    getSelectedAiProvider,
    maskApiKey,
    setAiApiKey,
    setSelectedAiProvider,
    clearAiApiKey,
    SUPPORTED_AI_PROVIDERS,
    validateProviderKey,
} from '@/lib/ai/gateway/config';
import { createAiClient } from '@/lib/ai/gateway/factory';
import type { AiProviderType } from '@/lib/ai/types';
import { useUIStore } from '@/store/ui';

export function GeminiKeyCard() {
    const addToast = useUIStore((s) => s.addToast);
    const [selectedProvider, setSelectedProviderState] = useState<AiProviderType>(getSelectedAiProvider());

    const meta = getProviderMeta(selectedProvider);
    const stored = getAiApiKey(selectedProvider);

    const [draft, setDraft] = useState('');
    const [hasKey, setHasKey] = useState(Boolean(stored));
    const [masked, setMasked] = useState(stored ? maskApiKey(stored) : '');
    const [isReplacing, setIsReplacing] = useState(false);
    const [fieldError, setFieldError] = useState<string | undefined>();
    const [isTesting, setIsTesting] = useState(false);

    const showEditor = !hasKey || isReplacing;

    const handleProviderChange = (newProvider: AiProviderType) => {
        setSelectedProviderState(newProvider);
        setSelectedAiProvider(newProvider);

        const newStored = getAiApiKey(newProvider);
        setHasKey(Boolean(newStored));
        setMasked(newStored ? maskApiKey(newStored) : '');
        setDraft('');
        setFieldError(undefined);
        setIsReplacing(false);
    };

    const persistAndRefresh = (key: string | null) => {
        if (key) {
            setAiApiKey(selectedProvider, key);
            setHasKey(true);
            setMasked(maskApiKey(key));
        } else {
            clearAiApiKey(selectedProvider);
            setHasKey(false);
            setMasked('');
        }
        setDraft('');
        setFieldError(undefined);
        setIsReplacing(false);
    };

    const handleSave = () => {
        const reason = validateProviderKey(selectedProvider, draft);
        if (reason) {
            setFieldError(reason);
            return;
        }
        persistAndRefresh(draft.trim());
        addToast(
            hasKey
                ? `API key de ${meta.label} reemplazada en este dispositivo`
                : `API key de ${meta.label} guardada en este dispositivo`,
            'success'
        );
    };

    const handleTest = async () => {
        const keyToTest = draft.trim() || getAiApiKey(selectedProvider);
        if (!keyToTest) {
            setFieldError(`Pega o guarda una API key de ${meta.label} primero.`);
            return;
        }
        const reason = validateProviderKey(selectedProvider, keyToTest);
        if (reason && draft.trim()) {
            setFieldError(reason);
            return;
        }

        setIsTesting(true);
        setFieldError(undefined);
        try {
            const client = createAiClient(selectedProvider, keyToTest);
            const result = await client.testConnection();
            if (result.ok) {
                if (draft.trim()) persistAndRefresh(draft.trim());
                addToast(result.message, 'success');
            } else {
                addToast(result.message, 'error');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al conectar';
            addToast(`Error: ${msg}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const handleForget = () => {
        persistAndRefresh(null);
        addToast(`API key de ${meta.label} eliminada de este dispositivo`, 'success');
    };

    const handleCancelReplace = () => {
        setDraft('');
        setFieldError(undefined);
        setIsReplacing(false);
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Sparkles size={18} />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                        Motor de Inteligencia Artificial
                    </h3>
                    <p className="text-[11px] text-slate-500">
                        Selecciona el proveedor activo para categorización automática
                    </p>
                </div>
            </div>

            {/* Responsive Provider Selection Grid (2x2 on mobile, 4-col on tablet/desktop) */}
            <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Proveedor Activo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SUPPORTED_AI_PROVIDERS.map((p) => {
                        const isSelected = p.id === selectedProvider;
                        const providerHasStoredKey = Boolean(getAiApiKey(p.id));

                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleProviderChange(p.id)}
                                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                                    isSelected
                                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                                }`}
                                data-testid={`ai-provider-select-${p.id}`}
                            >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="p-1 rounded-md bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200/60 dark:border-slate-700 shadow-2xs">
                                        <Cpu size={13} />
                                    </span>
                                    {providerHasStoredKey ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Key lista
                                        </span>
                                    ) : (
                                        <span className="text-[9px] text-slate-600 dark:text-slate-300">
                                            Sin key
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className={`text-xs font-bold truncate ${
                                        isSelected
                                            ? 'text-indigo-900 dark:text-indigo-200'
                                            : 'text-slate-800 dark:text-slate-200'
                                    }`}>
                                        {p.label}
                                    </p>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                                        {p.id === 'gemini' ? 'Google AI' : p.id === 'openai' ? 'ChatGPT' : p.id === 'groq' ? 'Llama 3 / Mixtral' : 'Claude 3.5'}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Provider Details */}
            <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                    <KeyRound size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-slate-900 dark:text-white text-xs">
                        {meta.label}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{meta.helpText}</p>
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-1 font-mono">
                        {meta.modelDescription}
                    </p>
                </div>
            </div>

            <a
                href={meta.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
                {meta.keyUrlLabel}
                <ExternalLink size={12} />
            </a>

            {hasKey ? (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 space-y-0.5">
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        API Key activa para {meta.label}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        Activa: <span className="font-mono">{masked}</span>
                    </p>
                </div>
            ) : (
                <p className="text-[11px] text-slate-500">
                    No hay API key configurada para {meta.label}. Pégala abajo para activar este motor.
                </p>
            )}

            {showEditor && (
                <Input
                    label={hasKey ? `Nueva API key de ${meta.label} (reemplazar)` : `API key de ${meta.label}`}
                    type="password"
                    revealPassword
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={meta.placeholder}
                    value={draft}
                    error={fieldError}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        setFieldError(undefined);
                    }}
                    data-testid="gemini-api-key-input"
                />
            )}

            <p className="text-[10px] text-slate-500">
                Las llaves se almacenan exclusivamente en este navegador. Nunca se transmiten a nuestros servidores ni entran en los backups JSON.
            </p>

            <div className="flex flex-wrap gap-2">
                {showEditor ? (
                    <>
                        <Button type="button" size="sm" onClick={handleSave} data-testid="gemini-api-key-save">
                            {hasKey ? 'Reemplazar' : 'Guardar'}
                        </Button>
                        {isReplacing && (
                            <Button type="button" size="sm" variant="ghost" onClick={handleCancelReplace}>
                                Cancelar
                            </Button>
                        )}
                    </>
                ) : (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsReplacing(true)}
                        data-testid="gemini-api-key-replace"
                    >
                        Cambiar key
                    </Button>
                )}
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleTest()}
                    isLoading={isTesting}
                    data-testid="gemini-api-key-test"
                >
                    Probar {meta.label}
                </Button>
                {hasKey && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleForget}
                        data-testid="gemini-api-key-forget"
                    >
                        <Trash2 size={14} />
                        Olvidar
                    </Button>
                )}
            </div>
        </div>
    );
}
