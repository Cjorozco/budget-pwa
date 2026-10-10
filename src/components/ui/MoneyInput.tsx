import { type InputHTMLAttributes, forwardRef, useState } from 'react';
import { Input } from './Input';
import { formatMoneyInput, numberToMoneyInput, parseMoneyInput } from '@/lib/utils';

interface MoneyInputProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> {
    label?: string;
    error?: string;
    value: number | undefined | null;
    onValueChange: (value: number | undefined) => void;
}

/** Campo de dinero con separador de miles (.) y decimales (,) automáticos, es-CO. */
const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
    ({ value, onValueChange, ...props }, ref) => {
        const [text, setText] = useState(() => numberToMoneyInput(value));
        const [lastEmitted, setLastEmitted] = useState<number | undefined>(value ?? undefined);

        // Sincroniza cuando el valor cambia desde fuera (reset, edición).
        const external = value ?? undefined;
        if (external !== lastEmitted && !(Number.isNaN(external) && Number.isNaN(lastEmitted))) {
            setLastEmitted(external);
            setText(numberToMoneyInput(external));
        }

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const el = e.target;
            const caret = el.selectionStart ?? el.value.length;
            const digitsBeforeCaret = el.value.slice(0, caret).replace(/[^\d,]/g, '').length;
            const formatted = formatMoneyInput(el.value);
            setText(formatted);
            const parsed = parseMoneyInput(formatted);
            setLastEmitted(parsed);
            onValueChange(parsed);

            requestAnimationFrame(() => {
                let seen = 0;
                let pos = formatted.length;
                if (digitsBeforeCaret === 0) pos = 0;
                else {
                    for (let i = 0; i < formatted.length; i++) {
                        if (/[\d,]/.test(formatted[i])) seen++;
                        if (seen === digitsBeforeCaret) { pos = i + 1; break; }
                    }
                }
                if (document.activeElement === el) el.setSelectionRange(pos, pos);
            });
        };

        return <Input {...props} ref={ref} type="text" inputMode="decimal" value={text} onChange={handleChange} />;
    }
);
MoneyInput.displayName = 'MoneyInput';

export { MoneyInput };
