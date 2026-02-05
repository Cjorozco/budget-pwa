import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CategoryForm } from '@/components/forms/CategoryForm';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import type { Category } from '@/lib/types';

export default function CategoriesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [defaultType, setDefaultType] = useState<'income' | 'expense'>('expense');
    const [defaultParentId, setDefaultParentId] = useState<string | undefined>(undefined);

    const categories = useLiveQuery(() => db.categories.filter(c => c.isActive).toArray()) || [];

    const incomeParents = categories
        .filter(c => c.type === 'income' && !c.parentId)
        .sort((a, b) => a.name.localeCompare(b.name));

    const expenseParents = categories
        .filter(c => c.type === 'expense' && !c.parentId)
        .sort((a, b) => a.name.localeCompare(b.name));

    const getChildren = (parentId: string) => {
        return categories
            .filter(c => c.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const handleDelete = async (category: Category) => {
        // Check if category has transactions
        const txCount = await db.transactions.where('categoryId').equals(category.id).count();

        if (txCount > 0) {
            if (!confirm(`Esta categoría tiene ${txCount} transacciones. ¿Seguro que quieres eliminarla? Las transacciones quedarán sin categoría.`)) {
                return;
            }
        }

        // Check if it's a parent with children
        const children = getChildren(category.id);
        if (children.length > 0) {
            alert(`No puedes eliminar esta categoría porque tiene ${children.length} subcategorías. Elimina primero las subcategorías.`);
            return;
        }

        try {
            await db.categories.update(category.id, { isActive: false });
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Error al eliminar la categoría');
        }
    };

    const CategoryItem = ({ category, isChild = false }: { category: Category; isChild?: boolean }) => (
        <div
            className={`flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 ${isChild ? 'ml-8' : ''
                }`}
        >
            <div className="flex items-center gap-3">
                {isChild && <ChevronRight size={16} className="text-slate-400" />}
                <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: category.color }}
                />
                <div>
                    <p className="font-medium text-slate-900 dark:text-white">{category.name}</p>
                    <p className="text-xs text-slate-500">
                        {category.type === 'income' ? 'Ingreso' : 'Gasto'}
                        {!isChild && getChildren(category.id).length > 0 && ` • ${getChildren(category.id).length} subcategorías`}
                    </p>
                </div>
            </div>
            <div className="flex gap-2">
                {!isChild && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            setDefaultType(category.type);
                            setDefaultParentId(category.id);
                            setEditingCategory(null);
                            setIsModalOpen(true);
                        }}
                        title="Agregar subcategoría"
                    >
                        <Plus size={14} />
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                        setEditingCategory(category);
                        setDefaultType(category.type);
                        setDefaultParentId(undefined);
                        setIsModalOpen(true);
                    }}
                >
                    <Pencil size={14} />
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(category)}
                >
                    <Trash2 size={14} />
                </Button>
            </div>
        </div>
    );

    return (
        <div className="p-4 safe-bottom space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Categorías</h1>
                    <p className="text-sm text-slate-500">Gestiona tus categorías de ingresos y gastos</p>
                </div>
                <Button
                    size="sm"
                    onClick={() => {
                        setEditingCategory(null);
                        setDefaultParentId(undefined);
                        setDefaultType('expense');
                        setIsModalOpen(true);
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" /> Nueva
                </Button>
            </div>

            {/* Income Categories */}
            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">Ingresos</h2>
                {incomeParents.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay categorías de ingresos</p>
                ) : (
                    <div className="space-y-2">
                        {incomeParents.map((parent) => (
                            <div key={parent.id} className="space-y-2">
                                <CategoryItem category={parent} />
                                {getChildren(parent.id).map((child) => (
                                    <CategoryItem key={child.id} category={child} isChild />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Expense Categories */}
            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Gastos</h2>
                {expenseParents.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay categorías de gastos</p>
                ) : (
                    <div className="space-y-2">
                        {expenseParents.map((parent) => (
                            <div key={parent.id} className="space-y-2">
                                <CategoryItem category={parent} />
                                {getChildren(parent.id).map((child) => (
                                    <CategoryItem key={child.id} category={child} isChild />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingCategory(null);
                    setDefaultParentId(undefined);
                }}
                title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            >
                <CategoryForm
                    initialData={editingCategory}
                    defaultType={defaultType}
                    defaultParentId={defaultParentId}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        setEditingCategory(null);
                        setDefaultParentId(undefined);
                    }}
                    onCancel={() => {
                        setIsModalOpen(false);
                        setEditingCategory(null);
                        setDefaultParentId(undefined);
                    }}
                />
            </Modal>
        </div>
    );
}
