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

export default function TemplatesPage() {
    const templates = useLiveQuery(() => db.quickTemplates.toArray()) || [];
    const [editingTemplate, setEditingTemplate] = useState<QuickTemplate | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const addToast = useUIStore(s => s.addToast);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingTemplate) return;

        try {
            if (editingTemplate.id.startsWith('new-')) {
                const { id, ...rest } = editingTemplate;
                await db.quickTemplates.add({
                    ...rest,
                    id: uuidv4(),
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                } as any);
                addToast('Plantilla creada', 'success');
            } else {
                await db.quickTemplates.update(editingTemplate.id, {
                    ...editingTemplate,
                    updatedAt: Date.now()
                });
                addToast('Plantilla actualizada', 'success');
            }
            setIsModalOpen(false);
            setEditingTemplate(null);
        } catch (error) {
            addToast('Error al guardar plantilla', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Borrar esta plantilla?')) return;
        try {
            await db.quickTemplates.delete(id);
            addToast('Plantilla eliminated', 'success');
        } catch (error) {
            addToast('Error al eliminar', 'error');
        }
    };

    return (
        <div className="p-4 safe-bottom space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plantillas</h1>
                    <p className="text-sm text-slate-500">Configura tus accesos rápidos</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
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
                    }}
                >
                    <Plus size={18} className="mr-1" /> Nueva
                </Button>
            </header>

            <div className="grid grid-cols-1 gap-3">
                {templates.map(template => (
                    <div key={template.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                            <span className="text-3xl bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">{template.icon}</span>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{template.name}</h3>
                                <p className="text-xs text-slate-500">{template.description || 'Sin descripción'}</p>
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
                title={editingTemplate?.id.startsWith('new-') ? 'Nueva Plantilla' : 'Editar Plantilla'}
            >
                {editingTemplate && (
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">ICONO</label>
                                <Input
                                    value={editingTemplate.icon}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, icon: e.target.value })}
                                    placeholder="Emoji"
                                    className="text-center text-xl"
                                />
                            </div>
                            <div className="col-span-3">
                                <label className="block text-xs font-bold text-slate-500 mb-1">NOMBRE</label>
                                <Input
                                    value={editingTemplate.name}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                    placeholder="Ej: Oxxo, Metro..."
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">DESCRIPCIÓN</label>
                            <Input
                                value={editingTemplate.description}
                                onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                                placeholder="¿De qué trata?"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">MONTO SUGERIDO</label>
                            <Input
                                type="number"
                                value={editingTemplate.amount}
                                onChange={e => setEditingTemplate({ ...editingTemplate, amount: Number(e.target.value) })}
                                placeholder="0"
                            />
                        </div>

                        <Button type="submit" className="w-full">
                            <Save size={18} className="mr-2" />
                            Guardar Plantilla
                        </Button>
                    </form>
                )}
            </Modal>
        </div>
    );
}
