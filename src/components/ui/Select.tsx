import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { label: string; value: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, options, ...props }, ref) => {
        const autoId = useId();
        const selectId = props.id ?? autoId;
        const errorId = `${selectId}-error`;
        return (
            <div className="space-y-1.5 w-full">
                {label && (
                    <label htmlFor={selectId} className="text-sm font-medium leading-none text-slate-700 dark:text-slate-300">
                        {label}
                    </label>
                )}
                <div className="relative">
                    <select
                        id={selectId}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : props['aria-describedby']}
                        className={cn(
                            "flex h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 font-sans",
                            error && "border-red-500",
                            className
                        )}
                        ref={ref}
                        {...props}
                    >
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-slate-500">
                        <ChevronDown size={16} />
                    </div>
                </div>
                {error && <p id={errorId} role="alert" className="text-xs text-red-700 dark:text-red-400 font-medium">{error}</p>}
            </div>
        );
    }
);
Select.displayName = "Select";

export { Select };
