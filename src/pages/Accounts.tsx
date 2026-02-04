import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { AccountForm } from '@/components/forms/AccountForm';
import { Modal } from '@/components/ui/Modal';
import { Plus, Wallet } from 'lucide-react';
import { AccountCard } from '@/components/accounts/AccountCard';
import { ReconciliationForm } from '@/components/forms/ReconciliationForm';
import { ReconciliationHistory } from '@/components/accounts/ReconciliationHistory';
import { ReserveForm } from '@/components/forms/ReserveForm';
import { ReservesList } from '@/components/accounts/ReservesList';
import type { Account } from '@/lib/types';

export default function AccountsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [reconcilingAccount, setReconcilingAccount] = useState<any>(null);
    const [historyAccount, setHistoryAccount] = useState<any>(null);
    const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
    const [isReservesListModalOpen, setIsReservesListModalOpen] = useState(false);
    const [reserveAccount, setReserveAccount] = useState<Account | null>(null);
    const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray());


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
                {accounts?.map((account) => (
                    <AccountCard
                        key={account.id}
                        account={account}
                        onEdit={(acc) => {
                            setEditingAccount(acc);
                            setIsModalOpen(true);
                        }}
                        onReconcile={(acc) => {
                            setReconcilingAccount(acc);
                            setIsReconcileModalOpen(true);
                        }}
                        onViewHistory={(acc) => {
                            setHistoryAccount(acc);
                            setIsHistoryModalOpen(true);
                        }}
                        onAddReserve={(acc) => {
                            setReserveAccount(acc);
                            setIsReserveModalOpen(true);
                        }}
                        onViewReserves={(acc) => {
                            setReserveAccount(acc);
                            setIsReservesListModalOpen(true);
                        }}
                    />
                ))}

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

            <Modal
                isOpen={isHistoryModalOpen}
                onClose={() => {
                    setIsHistoryModalOpen(false);
                    setHistoryAccount(null);
                }}
                title={`Historial: ${historyAccount?.name || ''}`}
            >
                {historyAccount && (
                    <ReconciliationHistory accountId={historyAccount.id} />
                )}
            </Modal>
            {/* Reserve Modal */}
            <Modal
                isOpen={isReserveModalOpen}
                onClose={() => setIsReserveModalOpen(false)}
                title={`Reservar Dinero - ${reserveAccount?.name}`}
            >
                {reserveAccount && (
                    <ReserveForm
                        account={reserveAccount}
                        onSuccess={() => setIsReserveModalOpen(false)}
                        onCancel={() => setIsReserveModalOpen(false)}
                    />
                )}
            </Modal>

            {/* Reserves List Modal */}
            <Modal
                isOpen={isReservesListModalOpen}
                onClose={() => setIsReservesListModalOpen(false)}
                title={`Detalle de Reservas: ${reserveAccount?.name}`}
            >
                {reserveAccount && (
                    <ReservesList accountId={reserveAccount.id} />
                )}
            </Modal>
        </div>
    );
}
