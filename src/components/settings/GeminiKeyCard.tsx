import { useState } from 'react';
import { ExternalLink, KeyRound, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    GEMINI_KEY_HELP,
    GEMINI_KEY_URL,
    GEMINI_MODEL,
    GEMINI_PROVIDER_LABEL,
} from '@/lib/ai/geminiConfig';
import {
    clearGeminiApiKey,
    getGeminiApiKey,
    maskGeminiApiKey,
    rejectedKeyReason,
    setGeminiApiKey,
} from '@/lib/ai/geminiKey';
import { testGeminiApiKey } from '@/lib/ai/geminiSuggest';
import { useUIStore } from '@/store/ui';

export function GeminiKeyCard() {
    const addToast = useUIStore((s) => s.addToast);
    const stored = getGeminiApiKey();
    const [draft, setDraft] = useState('');
    const [hasKey, setHasKey] = useState(Boolean(stored));
    const [masked, setMasked] = useState(stored ? maskGeminiApiKey(stored) : '');
    const [isReplacing, setIsReplacing] = useState(false);
    const [fieldError, setFieldError] = useState<string | undefined>();
    const [isTesting, setIsTesting] = useState(false);

    const showEditor = !hasKey || isReplacing;

    const persistAndRefresh = (key: string | null) => {
        if (key) {
            setGeminiApiKey(key);
            setHasKey(true);
            setMasked(maskGeminiApiKey(key));
        } else {
            clearGeminiApiKey();
            setHasKey(false);
            setMasked('');
        }
        setDraft('');
        setFieldError(undefined);
        setIsReplacing(false);
    };

    const handleSave = () => {
        const reason = rejectedKeyReason(draft);
        if (reason) {
            setFieldError(reason);
            return;
        }
        persistAndRefresh(draft.trim());
        addToast(
            hasKey ? 'API key de Gemini reemplazada en este dispositivo' : 'API key de Gemini guardada en este dispositivo',
            'success'
        );
    };

    const handleTest = async () => {
        const keyToTest = draft.trim() || getGeminiApiKey();
        if (!keyToTest) {
            setFieldError('Pega o guarda una API key de Gemini primero.');
            return;
        }
        const reason = rejectedKeyReason(keyToTest);
        if (reason && draft.trim()) {
            setFieldError(reason);
            return;
        }

        setIsTesting(true);
        setFieldError(undefined);
        try {
            const result = await testGeminiApiKey(keyToTest);
            if (result.ok) {
                if (draft.trim()) persistAndRefresh(draft.trim());
                addToast(`Conexión OK con ${GEMINI_PROVIDER_LABEL} (${GEMINI_MODEL})`, 'success');
            } else {
                addToast(result.message, 'error');
            }
        } finally {
            setIsTesting(false);
        }
    };

    const handleForget = () => {
        persistAndRefresh(null);
        addToast('API key de Gemini eliminada de este dispositivo', 'success');
    };

    const handleCancelReplace = () => {
        setDraft('');
        setFieldError(undefined);
        setIsReplacing(false);
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <Sparkles className="text-indigo-600 dark:text-indigo-400" size={20} />
                </div>
                <div className="min-w-0">
                    <h3 className="font-medium text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                        <KeyRound size={14} />
                        {GEMINI_PROVIDER_LABEL}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">{GEMINI_KEY_HELP.what}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{GEMINI_KEY_HELP.whatNot}</p>
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-1.5 font-mono">
                        {GEMINI_KEY_HELP.model}
                    </p>
                </div>
            </div>

            <a
                href={GEMINI_KEY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
            >
                Crear API key en Google AI Studio
                <ExternalLink size={12} />
            </a>

            {hasKey ? (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 space-y-0.5">
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Una sola key en este dispositivo
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        Activa: <span className="font-mono">{masked}</span>
                    </p>
                </div>
            ) : (
                <p className="text-[11px] text-slate-500">Solo se guarda una key. Si más adelante rotas la de AI Studio, úsala para reemplazar esta.</p>
            )}

            {showEditor && (
                <Input
                    label={hasKey ? 'Nueva API key (reemplaza la actual)' : 'API key de Gemini'}
                    type="password"
                    revealPassword
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Pega la key de AI Studio"
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
                La key no se sube a ningún servidor nuestro ni entra en el backup JSON. Si hay red, se envían a Google
                la descripción del movimiento y los nombres de tus categorías.
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
                    Probar {GEMINI_MODEL}
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
