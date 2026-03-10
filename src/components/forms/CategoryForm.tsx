import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { v4 as uuidv4 } from 'uuid';
import type { Category } from '@/lib/types';

const CategoryFormSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    type: z.enum(['income', 'expense']),
    color: z.string().min(1, 'Selecciona un color'),
    parentId: z.string().optional(),
});

type CategoryFormData = z.infer<typeof CategoryFormSchema>;

interface CategoryFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: Category | null;
    defaultType?: 'income' | 'expense';
    defaultParentId?: string;
}

const INCOME_COLORS = [
    { name: 'Esmeralda', value: '#10b981' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Lima', value: '#84cc16' },
    { name: 'Índigo', value: '#6366f1' },
    { name: 'Verde Bosque', value: '#15803d' },
    { name: 'Menta', value: '#34d399' },
    { name: 'Celeste', value: '#38bdf8' },
    { name: 'Azul Oscuro', value: '#1d4ed8' },
    { name: 'Violeta', value: '#7c3aed' },
    { name: 'Verde Oliva', value: '#65a30d' },
    { name: 'Turquesa', value: '#2dd4bf' },
    { name: 'Azul Cielo', value: '#7dd3fc' },
    { name: 'Azul Rey', value: '#2563eb' },
    { name: 'Morado Claro', value: '#a78bfa' },
    { name: 'Verde Pino', value: '#065f46' },
    { name: 'Aqua', value: '#0891b2' },
    { name: 'Azul Grisáceo', value: '#64748b' },
    { name: 'Azul Noche', value: '#0f172a' },
    { name: 'Morado Oscuro', value: '#4c1d95' },
    { name: 'Azul Acero', value: '#0369a1' },
    { name: 'Verde Mar', value: '#0f766e' },
    { name: 'Cian Oscuro', value: '#0e7490' },
];

const EXPENSE_COLORS = [
    { name: 'Rojo', value: '#ef4444' },
    { name: 'Naranja', value: '#f97316' },
    { name: 'Amarillo', value: '#f59e0b' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Púrpura', value: '#8b5cf6' },
    { name: 'Gris', value: '#64748b' },
    { name: 'Carmín', value: '#be123c' },
    { name: 'Coral', value: '#fb7185' },
    { name: 'Naranja Oscuro', value: '#ea580c' },
    { name: 'Melocotón', value: '#fdba74' },
    { name: 'Magenta', value: '#c026d3' },
    { name: 'Lavanda', value: '#c4b5fd' },
    { name: 'Rojo Oscuro', value: '#7f1d1d' },
    { name: 'Naranja Tostado', value: '#c2410c' },
    { name: 'Oro', value: '#ca8a04' },
    { name: 'Rosa Fuerte', value: '#db2777' },
    { name: 'Berenjena', value: '#701a75' },
    { name: 'Carbón', value: '#334155' },
    { name: 'Terracota', value: '#991b1b' },
    { name: 'Mandarina', value: '#fb923c' },
    { name: 'Mostaza', value: '#eab308' },
    { name: 'Fucsia', value: '#d946ef' },
    { name: 'Índigo Oscuro', value: '#312e81' },
    { name: 'Gris Claro', value: '#94a3b8' },
];

export function CategoryForm({ onSuccess, onCancel, initialData, defaultType, defaultParentId }: CategoryFormProps) {
    const parentCategories = useLiveQuery(() =>
        db.categories.filter(c => c.isActive && !c.parentId).toArray()
    ) || [];

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<CategoryFormData>({
        resolver: zodResolver(CategoryFormSchema),
        defaultValues: initialData ? {
            name: initialData.name,
            type: initialData.type,
            color: initialData.color,
            parentId: initialData.parentId || undefined,
        } : {
            name: '',
            type: defaultType || 'expense',
            color: (defaultType === 'income' ? INCOME_COLORS : EXPENSE_COLORS)[0].value,
            parentId: defaultParentId || undefined,
        },
    });

    const selectedType = watch('type');
    const selectedColor = watch('color');
    const filteredParents = parentCategories.filter(p => p.type === selectedType);

    // Determine which colors to show based on type
    const currentColors = selectedType === 'income' ? INCOME_COLORS : EXPENSE_COLORS;

    // Reset color if type changes and current color is not in the new list
    useEffect(() => {
        const isColorValid = currentColors.some(c => c.value === selectedColor);
        if (!isColorValid) {
            setValue('color', currentColors[0].value);
        }
    }, [selectedType, currentColors, selectedColor, setValue]);


    const onSubmit = async (data: CategoryFormData) => {
        try {
            if (initialData?.id) {
                // Edit mode
                await db.categories.update(initialData.id, {
                    name: data.name,
                    type: data.type,
                    color: data.color,
                    parentId: data.parentId || undefined,
                });
            } else {
                // Create mode
                await db.categories.add({
                    id: uuidv4(),
                    name: data.name,
                    type: data.type,
                    color: data.color,
                    parentId: data.parentId || undefined,
                    usageCount: 0,
                    isActive: true,
                });
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Error al guardar la categoría');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
                label="Nombre"
                placeholder="Ej. Comida rápida"
                error={errors.name?.message}
                {...register('name')}
            />

            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tipo
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input
                            type="radio"
                            value="income"
                            {...register('type')}
                            className="text-green-600"
                        />
                        <span className="text-sm">Ingreso</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input
                            type="radio"
                            value="expense"
                            {...register('type')}
                            className="text-red-600"
                        />
                        <span className="text-sm">Gasto</span>
                    </label>
                </div>
                {errors.type && (
                    <p className="text-sm text-red-600">{errors.type.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Categoría padre (opcional)
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    {...register('parentId')}
                >
                    <option value="">Ninguna (categoría principal)</option>
                    {filteredParents.map((parent) => (
                        <option key={parent.id} value={parent.id}>
                            {parent.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Color
                </label>
                <div className="grid grid-cols-6 gap-2">
                    {currentColors.map((color) => (
                        <label
                            key={color.value}
                            className={`relative h-10 rounded-lg cursor-pointer border-2 transition-all ${selectedColor === color.value
                                ? 'border-slate-900 dark:border-white scale-110'
                                : 'border-transparent hover:scale-105'
                                }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                        >
                            <input
                                type="radio"
                                value={color.value}
                                {...register('color')}
                                className="sr-only"
                            />
                        </label>
                    ))}
                </div>
                {errors.color && (
                    <p className="text-sm text-red-600">{errors.color.message}</p>
                )}
            </div>

            <div className="flex gap-3 pt-4 justify-end">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                    {initialData ? 'Actualizar' : 'Crear'} categoría
                </Button>
            </div>
        </form>
    );
}
