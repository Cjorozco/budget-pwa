import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Tag } from '@/lib/types';
import { X, Plus, Tag as TagIcon, Check, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TagSelectorProps {
    selectedTagIds: string[];
    onChange: (tagIds: string[]) => void;
}

export function TagSelector({ selectedTagIds, onChange }: TagSelectorProps) {
    const allTags = useLiveQuery(() => db.tags.orderBy('usageCount').reverse().toArray()) || [];
    const [isCreating, setIsCreating] = useState(false);
    const [newTagName, setNewTagName] = useState('');

    const handleToggleTag = async (tagId: string) => {
        const isSelected = selectedTagIds.includes(tagId);

        if (isSelected) {
            onChange(selectedTagIds.filter(id => id !== tagId));
            // Decrement usageCount (optional, but requested in logic)
            const tag = allTags.find(t => t.id === tagId);
            if (tag) {
                await db.tags.update(tagId, {
                    usageCount: Math.max(0, tag.usageCount - 1),
                    updatedAt: Date.now()
                });
            }
        } else {
            onChange([...selectedTagIds, tagId]);
            // Increment usageCount
            const tag = allTags.find(t => t.id === tagId);
            if (tag) {
                await db.tags.update(tagId, {
                    usageCount: tag.usageCount + 1,
                    updatedAt: Date.now()
                });
            }
        }
    };

    const handleDeleteTag = async (tagId: string) => {
        const tag = allTags.find(t => t.id === tagId);
        if (!tag) return;
        if (!window.confirm(`¿Eliminar la etiqueta "${tag.name}"? Se quitará de todas las transacciones.`)) return;

        // Quitar de selección actual si está seleccionada
        if (selectedTagIds.includes(tagId)) {
            onChange(selectedTagIds.filter(id => id !== tagId));
        }

        // Limpiar tagIds en transacciones que la referencien
        const txsWithTag = await db.transactions
            .filter(tx => (tx.tagIds || []).includes(tagId))
            .toArray();
        for (const tx of txsWithTag) {
            await db.transactions.update(tx.id, {
                tagIds: tx.tagIds.filter(id => id !== tagId)
            });
        }

        // Eliminar la etiqueta de la base de datos
        await db.tags.delete(tagId);
    };

    const handleCreateTag = async () => {
        const name = newTagName.trim();
        if (!name) return;

        // Check if tag already exists (case insensitive)
        const exists = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            if (!selectedTagIds.includes(exists.id)) {
                handleToggleTag(exists.id);
            }
            setNewTagName('');
            setIsCreating(false);
            return;
        }

        const colors = ['#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#6366F1'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const newTag: Tag = {
            id: uuidv4(),
            name,
            color: randomColor,
            usageCount: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await db.tags.add(newTag);
        onChange([...selectedTagIds, newTag.id]);
        setNewTagName('');
        setIsCreating(false);
    };

    const selectedTags = allTags.filter(tag => selectedTagIds.includes(tag.id));
    const availableTags = allTags.filter(tag => !selectedTagIds.includes(tag.id));

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Etiquetas (opcional)
            </label>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tag => (
                        <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleToggleTag(tag.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all hover:opacity-80 shadow-sm"
                            style={{ backgroundColor: tag.color }}
                        >
                            <TagIcon className="w-3 h-3" />
                            {tag.name}
                            <X className="w-3 h-3 hover:bg-black/10 rounded-full" />
                        </button>
                    ))}
                </div>
            )}

            {/* Available Tags & Create */}
            <div className="flex flex-wrap gap-2 items-center">
                {availableTags.slice(0, 10).map(tag => (
                    <div key={tag.id} className="inline-flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => handleToggleTag(tag.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-full text-xs font-medium border-2 border-r-0 transition-all hover:scale-105"
                            style={{
                                borderColor: `${tag.color}40`,
                                color: tag.color,
                                backgroundColor: `${tag.color}10`
                            }}
                        >
                            <Plus className="w-3 h-3" />
                            {tag.name}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDeleteTag(tag.id)}
                            title="Eliminar etiqueta"
                            className="inline-flex items-center px-1.5 py-1.5 rounded-r-full text-xs border-2 border-l-0 transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
                            style={{
                                borderColor: `${tag.color}40`,
                                color: `${tag.color}80`
                            }}
                        >
                            <Trash2 className="w-3 h-3 text-red-400 hover:text-red-600" />
                        </button>
                    </div>
                ))}

                {!isCreating ? (
                    <button
                        type="button"
                        onClick={() => setIsCreating(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-400 dark:hover:border-slate-600 transition-all"
                    >
                        <Plus className="w-3 h-3" />
                        Nueva
                    </button>
                ) : (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
                        <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCreateTag();
                                }
                                if (e.key === 'Escape') {
                                    setIsCreating(false);
                                    setNewTagName('');
                                }
                            }}
                            placeholder="Nombre..."
                            className="px-3 py-1 text-xs bg-transparent border-none focus:ring-0 w-24 dark:text-white"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleCreateTag}
                            className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full transition-colors"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreating(false);
                                setNewTagName('');
                            }}
                            className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <p className="text-[10px] text-slate-500 italic">
                💡 Usa etiquetas para agrupar por personas, viajes o eventos especiales.
            </p>
        </div>
    );
}
