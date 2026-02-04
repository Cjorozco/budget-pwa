import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { AccountForm } from '@/components/forms/AccountForm';
import { Modal } from '@/components/ui/Modal';
import { Plus, Wallet, CreditCard, Banknote, Pencil, History, CheckCircle2 } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { ReconciliationForm } from '@/components/forms/ReconciliationForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AccountsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [reconcilingAccount, setReconcilingAccount] = useState<any>(null);
    const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray());

    const getIcon = (type: string) => {
        switch (type) {
            case 'cash': return Banknote;
            case 'credit': return CreditCard;
            default: return Wallet;
        }
    };

    return (
        <div className="p-4 safe-bottom space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cuentas</h1>
                    <p className="text-sm text-slate-500">Administra tus fuentes de dinero</p>
                </div>
                <Button size="sm" onClick={() => {
                    setEditingAccount(null);
                    setIsModalOpen(true);
                }}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts?.map((account) => {
                    const Icon = getIcon(account.type);
                    return (
                        <div
                            key={account.id}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                        >
                            <div className={cn(
                                "absolute top-0 right-0 p-3 opacity-10",
                                account.type === 'credit' ? "text-purple-600" : "text-blue-600"
                            )}>
                                <Icon size={80} />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={cn(
                                        "p-2.5 rounded-xl",
                                        account.type === 'credit' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" :
                                            account.type === 'cash' ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                                                "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                                    )}>
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{account.name}</h3>
                                        <span className="text-xs text-slate-500 capitalize">{account.type === 'bank' ? 'Bancaria' : account.type === 'credit' ? 'Crédito' : 'Efectivo'}</span>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-end justify-between">
                                    <div>
                                        <span className="text-xs text-slate-500 block mb-1">Saldo Actual</span>
                                        <div className={cn(
                                            "text-2xl font-bold tracking-tight",
                                            account.calculatedBalance < 0 ? "text-red-600" : "text-slate-900 dark:text-white"
                                        )}>
                                            $ {account.calculatedBalance.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                            onClick={() => {
                                                setReconcilingAccount(account);
                                                setIsReconcileModalOpen(true);
                                            }}
                                            title="Reconciliar"
                                        >
                                            <History size={16} className="text-blue-600" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                            onClick={() => {
                                                setEditingAccount(account);
                                                setIsModalOpen(true);
                                            }}
                                            title="Editar"
                                        >
                                            <Pencil size={16} />
                                        </Button>
                                    </div>
                                </div>

                                {account.lastReconciliationDate && (
                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                            <CheckCircle2 size={12} className="text-green-500" />
                                            <span>
                                                Reconciliado: {format(account.lastReconciliationDate, "d MMM", { locale: es })}
                                            </span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400">
                                            {formatCurrency(account.actualBalance || 0)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {accounts?.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <Wallet className="mx-auto h-12 w-12 opacity-20 mb-3" />
                        <p>No tienes cuentas registradas.</p>
                        <Button variant="link" onClick={() => setIsModalOpen(true)}>Crear la primera</Button>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingAccount(null);
                }}
                title={editingAccount ? "Editar Cuenta" : "Nueva Cuenta"}
            >
                <AccountForm
                    initialData={editingAccount}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        setEditingAccount(null);
                    }}
                    onCancel={() => {
                        setIsModalOpen(false);
                        setEditingAccount(null);
                    }}
                />
            </Modal>

            <Modal
                isOpen={isReconcileModalOpen}
                onClose={() => {
                    setIsReconcileModalOpen(false);
                    setReconcilingAccount(null);
                }}
                title={`Reconciliar ${reconcilingAccount?.name || ''}`}
            >
                {reconcilingAccount && (
                    <ReconciliationForm
                        account={reconcilingAccount}
                        onSuccess={() => {
                            setIsReconcileModalOpen(false);
                            setReconcilingAccount(null);
                        }}
                        onCancel={() => {
                            setIsReconcileModalOpen(false);
                            setReconcilingAccount(null);
                        }}
                    />
                )}
            </Modal>
        </div>
    );
}
