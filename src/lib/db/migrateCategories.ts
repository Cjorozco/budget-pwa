import { db } from './index';
import { findOrCreateCategory } from '../ai/categoryResolver';
import { normalizeForMatch } from '../ai/categoryRules';

/**
 * Ajustes incrementales para bases de datos existentes (no borra datos del usuario).
 */
export async function migrateCategories(): Promise<void> {
    await db.transaction('rw', db.categories, async () => {
        const categories = await db.categories.toArray();

        // Sueldo → Salario
        const sueldo = categories.find(
            (c) => c.type === 'income' && !c.parentId && normalizeForMatch(c.name) === 'sueldo'
        );
        if (sueldo) {
            await db.categories.update(sueldo.id, { name: 'Salario' });
        }

        // Renombrar subcategoría Mamá bajo Otros → migrar referencias después si existe Apoyos
        const mamaSub = categories.find(
            (c) =>
                c.type === 'income' &&
                c.parentId &&
                (normalizeForMatch(c.name) === 'mama' || normalizeForMatch(c.name) === 'mamá')
        );
        if (mamaSub) {
            await db.categories.update(mamaSub.id, { name: 'Ayuda familiar (legacy)' });
        }
    });

    // Asegurar categorías clave para reglas del categorizador.
    // No precrear Sofia › Transporte: si existe, el form auto-aplica y oculta
    // el panel "Crear y aplicar" (escena de marketing y primer uso real).
    await findOrCreateCategory('income', 'Salario', 'Nómina');
    await findOrCreateCategory('income', 'Freelance');
    await findOrCreateCategory('income', 'Apoyos', 'Ayuda familiar');
    await findOrCreateCategory('expense', 'Transporte', 'Privado');
    await findOrCreateCategory('expense', 'Transporte', 'Transporte público');
}
