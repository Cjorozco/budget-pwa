import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useUIStore } from '@/store/ui';
import { Save, Plus, Trash2, Edit2 } from 'lucide-react';
import type { QuickTemplate } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { useLicenseStore } from '@/store/licenseStore';
import { ProBadge } from '@/components/ui/ProBadge';
import { useTranslation } from '@/lib/i18n';

export default function TemplatesPage() {
    const { t } = useTranslation();
    const templates = useLiveQuery(() => db.quickTemplates.toArray()) || [];
    const [editingTemplate, setEditingTemplate] = useState<QuickTemplate | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast, confirm } = useUIStore();
    const { canCreateTemplate, openUpgradeModal, isPro } = useLicenseStore();

    const handleOpenNewTemplate = () => {
        if (!canCreateTemplate(templates.length)) {
            openUpgradeModal(t.templates.proLimitTemplates);
            return;
        }
        setEditingTemplate({
            id: 'new-' + Date.now(),
            name: '',
            icon: '💰',
            description: '',
            amount: 0,
            type: 'expense',
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingTemplate) return;

        try {
            if (editingTemplate.id.startsWith('new-')) {
                const rest: Partial<QuickTemplate> = { ...editingTemplate };
                delete rest.id;
                await db.quickTemplates.add({
                    ...(rest as Omit<QuickTemplate, 'id'>),
                    id: uuidv4(),
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
                addToast(t.templates.templateCreated, 'success');
            } else {
                await db.quickTemplates.update(editingTemplate.id, {
                    ...editingTemplate,
                    updatedAt: Date.now()
                });
                addToast(t.templates.templateUpdated, 'success');
            }
            setIsModalOpen(false);
            setEditingTemplate(null);
        } catch {
            addToast(t.common.error, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: t.templates.deleteTemplateTitle,
            message: t.templates.deleteTemplateMsg,
            confirmLabel: t.common.delete,
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await db.quickTemplates.delete(id);
            addToast(t.templates.templateDeleted, 'success');
        } catch {
            addToast(t.common.error, 'error');
        }
    };

    return (
        <div className="p-4 safe-bottom space-y-6">
            <header className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.templates.templatesTitle}</h1>
                            {!isPro && <ProBadge showUnlockAction size="sm" />}
                        </div>
                        <p className="text-sm text-slate-500">{t.templates.templatesSubtitle}</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenNewTemplate}
                >
                    <Plus size={18} className="mr-1" /> {t.templates.newTemplate}
                </Button>
            </header>

            <div className="grid grid-cols-1 gap-3">
                {templates.map(template => (
                    <div key={template.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                            <span className="text-3xl bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">{template.icon}</span>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{template.name}</h3>
                                <p className="text-xs text-slate-500">{template.description || t.templates.noDescription}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => {
                                setEditingTemplate(template);
                                setIsModalOpen(true);
                            }}>
                                <Edit2 size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(template.id)}>
                                <Trash2 size={16} />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTemplate?.id.startsWith('new-') ? t.templates.newTemplateModal : t.templates.editTemplateModal}
            >
                {editingTemplate && (
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">{t.templates.iconLabel}</label>
                                <Input
                                    value={editingTemplate.icon}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, icon: e.target.value })}
                                    placeholder="Emoji"
                                    className="text-center text-xl"
                                />
                            </div>
                            <div className="col-span-3">
                                <label className="block text-xs font-bold text-slate-500 mb-1">{t.templates.nameLabel}</label>
                                <Input
                                    value={editingTemplate.name}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                    placeholder={t.templates.namePlaceholder}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t.templates.descriptionLabel}</label>
                            <Input
                                value={editingTemplate.description}
                                onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                                placeholder={t.templates.descriptionPlaceholder}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t.templates.suggestedAmountLabel}</label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                value={editingTemplate.amount === 0 ? '' : editingTemplate.amount}
                                onChange={e => {
                                    const val = e.target.value;
                                    setEditingTemplate({ ...editingTemplate, amount: val === '' ? 0 : Number(val) });
                                }}
                                placeholder="0"
                            />
                        </div>

                        <div className="pt-2">
                            <Button type="submit" className="w-full h-14 text-lg" isLoading={false}>
                                <Save size={20} className="mr-2" />
                                {t.templates.saveTemplateBtn}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
