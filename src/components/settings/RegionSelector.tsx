import { Check, Landmark } from 'lucide-react';
import { db } from '@/lib/db';
import { useTranslation } from '@/lib/i18n';
import { COUNTRIES, CURRENCY_BY_COUNTRY, regionFor, type CountryCode } from '@/lib/region/region';
import { useRegionStore } from '@/lib/region/regionStore';
import { useUIStore } from '@/store/ui';

const FLAGS: Record<CountryCode, string> = { CO: '🇨🇴', CA: '🇨🇦', US: '🇺🇸' };

export function RegionSelector() {
    const { t } = useTranslation();
    const country = useRegionStore((state) => state.country);
    const confirm = useUIStore((state) => state.confirm);
    const addToast = useUIStore((state) => state.addToast);

    const handleSelect = async (next: CountryCode) => {
        if (next === country) return;
        const from = regionFor(country);
        const to = regionFor(next);

        // Read the count now, not from a reactive query that may not have loaded yet.
        const accountCount = await db.accounts.count();
        // With no accounts nothing is relabeled, so there is nothing to warn about.
        if (accountCount > 0) {
            const ok = await confirm({
                title: t.region.changeTitle,
                message: t.region.changeMessage
                    .replace('{count}', String(accountCount))
                    .replace('{from}', from.currency)
                    .replace('{to}', to.currency),
                confirmLabel: t.region.changeConfirm,
                variant: 'danger',
            });
            if (!ok) return;
        }

        await db.transaction('rw', db.accounts, db.appConfig, async () => {
            await db.accounts.toCollection().modify({ currency: to.currency });
            await db.appConfig.toCollection().modify({ defaultCurrency: to.currency, country: next });
        });
        useRegionStore.getState().setCountry(next);
        addToast(
            t.region.changed.replace('{country}', t.region.countries[next]).replace('{currency}', to.currency),
            'success'
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
                    <Landmark className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.region.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.region.description}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
                {COUNTRIES.map((code) => {
                    const isSelected = code === country;
                    return (
                        <button
                            key={code}
                            type="button"
                            onClick={() => void handleSelect(code)}
                            aria-pressed={isSelected}
                            data-testid={`region-select-${code}`}
                            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                                isSelected
                                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="text-xl" aria-hidden="true">{FLAGS[code]}</span>
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{t.region.countries[code]}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {t.region.currencyLine.replace('{currency}', CURRENCY_BY_COUNTRY[code])}
                                    </p>
                                </div>
                            </div>
                            {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
