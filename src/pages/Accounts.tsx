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
import type { Account, Reserve } from '@/lib/types';
import { useLicenseStore } from '@/store/licenseStore';
import { ProBadge } from '@/components/ui/ProBadge';
import { useTranslation } from '@/lib/i18n';

export default function AccountsPage() {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [reconcilingAccount, setReconcilingAccount] = useState<Account | null>(null);
    const [historyAccount, setHistoryAccount] = useState<Account | null>(null);
    const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
    const [isReservesListModalOpen, setIsReservesListModalOpen] = useState(false);
    const [reserveAccount, setReserveAccount] = useState<Account | null>(null);
    const [editingReserve, setEditingReserve] = useState<Reserve | null>(null);
    const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray());
    const activeReservesCount = useLiveQuery(() => db.reserves.filter(r => r.isActive).count()) || 0;

    const { canCreateAccount, canCreateReserve, openUpgradeModal, isPro } = useLicenseStore();

    const handleOpenNewAccount = () => {
        if (!canCreateAccount(accounts?.length || 0)) {
            openUpgradeModal(t.accounts.proLimitAccounts);
            return;
        }
        setEditingAccount(null);
        setIsModalOpen(true);
    };

    const handleOpenAddReserve = (acc: Account) => {
        if (!canCreateReserve(activeReservesCount)) {
            openUpgradeModal(t.accounts.proLimitReserves);
            return;
        }
        setReserveAccount(acc);
        setEditingReserve(null);
        setIsReserveModalOpen(true);
    };

    return (
        <div className="p-4 safe-bottom space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.accounts.title}</h1>
                            {!isPro && <ProBadge showUnlockAction size="sm" />}
                        </div>
                        <p className="text-sm text-slate-500">{t.accounts.subtitle}</p>
                    </div>
                </div>
                <Button size="sm" onClick={handleOpenNewAccount}>
                    <Plus className="mr-2 h-4 w-4" /> {t.accounts.newAccountBtn}
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
                        onAddReserve={handleOpenAddReserve}
                        onViewReserves={(acc) => {
                            setReserveAccount(acc);
                            setIsReservesListModalOpen(true);
                        }}
                    />
                ))}

                {accounts?.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <Wallet className="mx-auto h-12 w-12 opacity-20 mb-3" />
                        <p>{t.accounts.noAccountsRegistered}</p>
                        <Button variant="link" onClick={() => setIsModalOpen(true)}>{t.accounts.createFirstAccount}</Button>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingAccount(null);
                }}
                title={editingAccount ? t.accounts.editAccount : t.accounts.newAccount}
            >
                <AccountForm
                    initialData={editingAccount ?? undefined}
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
                title={t.accounts.reconcileWith.replace('{name}', reconcilingAccount?.name || '')}
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
                title={t.accounts.historyWith.replace('{name}', historyAccount?.name || '')}
            >
                {historyAccount && (
                    <ReconciliationHistory accountId={historyAccount.id} />
                )}
            </Modal>
            {/* Reserve Modal */}
            <Modal
                isOpen={isReserveModalOpen}
                onClose={() => {
                    setIsReserveModalOpen(false);
                    setEditingReserve(null);
                }}
                title={editingReserve
                    ? t.accounts.editReserveWith.replace('{name}', reserveAccount?.name || '')
                    : t.accounts.reserveMoneyWith.replace('{name}', reserveAccount?.name || '')}
            >
                {reserveAccount && (
                    <ReserveForm
                        account={reserveAccount}
                        initialData={editingReserve ? {
                            id: editingReserve.id,
                            amount: editingReserve.amount,
                            description: editingReserve.description,
                        } : undefined}
                        onSuccess={() => {
                            setIsReserveModalOpen(false);
                            setEditingReserve(null);
                        }}
                        onCancel={() => {
                            setIsReserveModalOpen(false);
                            setEditingReserve(null);
                        }}
                    />
                )}
            </Modal>

            {/* Reserves List Modal */}
            <Modal
                isOpen={isReservesListModalOpen}
                onClose={() => setIsReservesListModalOpen(false)}
                title={t.accounts.reservesDetailWith.replace('{name}', reserveAccount?.name || '')}
            >
                {reserveAccount && (
                    <ReservesList
                        accountId={reserveAccount.id}
                        onEditReserve={(reserve) => {
                            setEditingReserve(reserve);
                            setIsReservesListModalOpen(false);
                            setIsReserveModalOpen(true);
                        }}
                    />
                )}
            </Modal>
        </div>
    );
}
