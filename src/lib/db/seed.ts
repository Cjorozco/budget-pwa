import { db } from './index';
import { v4 as uuidv4 } from 'uuid';

export const seedInitialData = async () => {
    // Use a transaction to ensure atomicity and prevent race conditions in React StrictMode
    await db.transaction('rw', db.categories, db.accounts, db.tags, db.appConfig, async () => {
        const categoryCount = await db.categories.count();

        if (categoryCount === 0) {
            // INCOME CATEGORIES
            const sueldoId = uuidv4();
            const otrosIngresoId = uuidv4();

            // EXPENSE CATEGORIES
            const ninosId = uuidv4();
            const deudaId = uuidv4();
            const educacionId = uuidv4();
            const ocioId = uuidv4();
            const gastosDiariosId = uuidv4();
            const regalosId = uuidv4();
            const saludId = uuidv4();
            const viviendaId = uuidv4();
            const segurosId = uuidv4();
            const mascotasId = uuidv4();
            const tecnologiaId = uuidv4();
            const transporteId = uuidv4();
            const viajesId = uuidv4();
            const serviciosBasicosId = uuidv4();

            await db.categories.bulkAdd([
                // ===== INCOME PARENTS =====
                { id: sueldoId, name: 'Sueldo', type: 'income', color: '#10b981', usageCount: 0, isActive: true },
                { id: otrosIngresoId, name: 'Otros', type: 'income', color: '#6366f1', usageCount: 0, isActive: true },

                // ===== INCOME CHILDREN - Sueldo =====
                { id: uuidv4(), name: 'Nómina', type: 'income', color: '#10b981', parentId: sueldoId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Propinas', type: 'income', color: '#10b981', parentId: sueldoId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Bonificaciones', type: 'income', color: '#10b981', parentId: sueldoId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Comisiones', type: 'income', color: '#10b981', parentId: sueldoId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'income', color: '#10b981', parentId: sueldoId, usageCount: 0, isActive: true },

                // ===== INCOME CHILDREN - Otros =====
                { id: uuidv4(), name: 'Ingresos por intereses', type: 'income', color: '#6366f1', parentId: otrosIngresoId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Dividendos', type: 'income', color: '#6366f1', parentId: otrosIngresoId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Regalos', type: 'income', color: '#6366f1', parentId: otrosIngresoId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Reembolsos', type: 'income', color: '#6366f1', parentId: otrosIngresoId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'income', color: '#6366f1', parentId: otrosIngresoId, usageCount: 0, isActive: true },

                // ===== EXPENSE PARENTS =====
                { id: ninosId, name: 'Niños', type: 'expense', color: '#ec4899', usageCount: 0, isActive: true },
                { id: deudaId, name: 'Deuda', type: 'expense', color: '#dc2626', usageCount: 0, isActive: true },
                { id: educacionId, name: 'Educación', type: 'expense', color: '#8b5cf6', usageCount: 0, isActive: true },
                { id: ocioId, name: 'Ocio', type: 'expense', color: '#f59e0b', usageCount: 0, isActive: true },
                { id: gastosDiariosId, name: 'Gastos diarios', type: 'expense', color: '#3b82f6', usageCount: 0, isActive: true },
                { id: regalosId, name: 'Regalos', type: 'expense', color: '#ef4444', usageCount: 0, isActive: true },
                { id: saludId, name: 'Salud/médicos', type: 'expense', color: '#14b8a6', usageCount: 0, isActive: true },
                { id: viviendaId, name: 'Vivienda', type: 'expense', color: '#a855f7', usageCount: 0, isActive: true },
                { id: segurosId, name: 'Seguros', type: 'expense', color: '#06b6d4', usageCount: 0, isActive: true },
                { id: mascotasId, name: 'Mascotas', type: 'expense', color: '#84cc16', usageCount: 0, isActive: true },
                { id: tecnologiaId, name: 'Tecnología', type: 'expense', color: '#6366f1', usageCount: 0, isActive: true },
                { id: transporteId, name: 'Transporte', type: 'expense', color: '#0ea5e9', usageCount: 0, isActive: true },
                { id: viajesId, name: 'Viajes', type: 'expense', color: '#f97316', usageCount: 0, isActive: true },
                { id: serviciosBasicosId, name: 'Servicios básicos', type: 'expense', color: '#64748b', usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Niños =====
                { id: uuidv4(), name: 'Actividades', type: 'expense', color: '#ec4899', parentId: ninosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Cuota o básicos', type: 'expense', color: '#ec4899', parentId: ninosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Gastos médicos', type: 'expense', color: '#ec4899', parentId: ninosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Guardería', type: 'expense', color: '#ec4899', parentId: ninosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Ropa', type: 'expense', color: '#ec4899', parentId: ninosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Colegio', type: 'expense', color: '#ec4899', parentId: ninosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Juguetes', type: 'expense', color: '#ec4899', parentId: ninosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#ec4899', parentId: ninosId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Deuda =====
                { id: uuidv4(), name: 'Tarjeta de crédito', type: 'expense', color: '#dc2626', parentId: deudaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Préstamo personal', type: 'expense', color: '#dc2626', parentId: deudaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Préstamo estudiantil', type: 'expense', color: '#dc2626', parentId: deudaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#dc2626', parentId: deudaId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Educación =====
                { id: uuidv4(), name: 'Matrícula', type: 'expense', color: '#8b5cf6', parentId: educacionId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Libros', type: 'expense', color: '#8b5cf6', parentId: educacionId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Clases de música', type: 'expense', color: '#8b5cf6', parentId: educacionId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Platzi', type: 'expense', color: '#8b5cf6', parentId: educacionId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#8b5cf6', parentId: educacionId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Ocio =====
                { id: uuidv4(), name: 'Cine', type: 'expense', color: '#f59e0b', parentId: ocioId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Citas', type: 'expense', color: '#f59e0b', parentId: ocioId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Conciertos o espectáculos', type: 'expense', color: '#f59e0b', parentId: ocioId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Deporte', type: 'expense', color: '#f59e0b', parentId: ocioId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Juegos', type: 'expense', color: '#f59e0b', parentId: ocioId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Rumba', type: 'expense', color: '#f59e0b', parentId: ocioId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Vacaciones', type: 'expense', color: '#f59e0b', parentId: ocioId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#f59e0b', parentId: ocioId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Gastos diarios =====
                { id: uuidv4(), name: 'Higiene personal', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Laundry', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Supermercado', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Peluquería o belleza', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Restaurantes', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Ropa', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Suscripciones', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Snacks/⛽', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#3b82f6', parentId: gastosDiariosId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Regalos =====
                { id: uuidv4(), name: 'Regalos', type: 'expense', color: '#ef4444', parentId: regalosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Donativos (ONG)', type: 'expense', color: '#ef4444', parentId: regalosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#ef4444', parentId: regalosId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Salud/médicos =====
                { id: uuidv4(), name: 'Médicos (dentista/oculista)', type: 'expense', color: '#14b8a6', parentId: saludId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Especialistas', type: 'expense', color: '#14b8a6', parentId: saludId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Farmacia', type: 'expense', color: '#14b8a6', parentId: saludId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Urgencias', type: 'expense', color: '#14b8a6', parentId: saludId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#14b8a6', parentId: saludId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Vivienda =====
                { id: uuidv4(), name: 'Alquiler o hipoteca', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Artículos para el hogar', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Césped o jardín', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Impuestos a la propiedad', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Mantenimiento', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Mejoras', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Mudanza', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Muebles', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#a855f7', parentId: viviendaId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Seguros =====
                { id: uuidv4(), name: 'Vehículo', type: 'expense', color: '#06b6d4', parentId: segurosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Salud', type: 'expense', color: '#06b6d4', parentId: segurosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Hogar', type: 'expense', color: '#06b6d4', parentId: segurosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Vida', type: 'expense', color: '#06b6d4', parentId: segurosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#06b6d4', parentId: segurosId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Mascotas =====
                { id: uuidv4(), name: 'Comida', type: 'expense', color: '#84cc16', parentId: mascotasId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Veterinario o medicinas', type: 'expense', color: '#84cc16', parentId: mascotasId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Juguetes', type: 'expense', color: '#84cc16', parentId: mascotasId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Suministros', type: 'expense', color: '#84cc16', parentId: mascotasId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#84cc16', parentId: mascotasId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Tecnología =====
                { id: uuidv4(), name: 'Dominios y alojamiento', type: 'expense', color: '#6366f1', parentId: tecnologiaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Servicios online', type: 'expense', color: '#6366f1', parentId: tecnologiaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Hardware', type: 'expense', color: '#6366f1', parentId: tecnologiaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Software', type: 'expense', color: '#6366f1', parentId: tecnologiaId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#6366f1', parentId: tecnologiaId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Transporte =====
                { id: uuidv4(), name: 'Combustible', type: 'expense', color: '#0ea5e9', parentId: transporteId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Matriculación o permiso', type: 'expense', color: '#0ea5e9', parentId: transporteId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Pagos del vehículo', type: 'expense', color: '#0ea5e9', parentId: transporteId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Reparaciones', type: 'expense', color: '#0ea5e9', parentId: transporteId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Suministros', type: 'expense', color: '#0ea5e9', parentId: transporteId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Transporte público', type: 'expense', color: '#0ea5e9', parentId: transporteId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#0ea5e9', parentId: transporteId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Viajes =====
                { id: uuidv4(), name: 'Bebidas o Comidas', type: 'expense', color: '#f97316', parentId: viajesId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Billetes de avión', type: 'expense', color: '#f97316', parentId: viajesId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Clothing, Shoes & Jewelry', type: 'expense', color: '#f97316', parentId: viajesId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Hoteles', type: 'expense', color: '#f97316', parentId: viajesId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Laundry & Pharmacy', type: 'expense', color: '#f97316', parentId: viajesId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Transporte', type: 'expense', color: '#f97316', parentId: viajesId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#f97316', parentId: viajesId, usageCount: 0, isActive: true },

                // ===== EXPENSE CHILDREN - Servicios básicos =====
                { id: uuidv4(), name: 'Agua', type: 'expense', color: '#64748b', parentId: serviciosBasicosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Cable/Internet', type: 'expense', color: '#64748b', parentId: serviciosBasicosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Calefacción o gas', type: 'expense', color: '#64748b', parentId: serviciosBasicosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Electricidad', type: 'expense', color: '#64748b', parentId: serviciosBasicosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Teléfono/Celular', type: 'expense', color: '#64748b', parentId: serviciosBasicosId, usageCount: 0, isActive: true },
                { id: uuidv4(), name: 'Otros', type: 'expense', color: '#64748b', parentId: serviciosBasicosId, usageCount: 0, isActive: true },
            ]);
        }

        const accountCount = await db.accounts.count();
        if (accountCount === 0) {
            // Default Accounts requested by user
            await db.accounts.bulkAdd([
                {
                    id: uuidv4(),
                    name: 'Efectivo',
                    type: 'cash',
                    calculatedBalance: 0,
                    currency: 'COP',
                    isActive: true
                },
                {
                    id: uuidv4(),
                    name: 'Bancolombia',
                    type: 'bank',
                    calculatedBalance: 0,
                    currency: 'COP',
                    isActive: true
                }
            ]);
        }

        const configCount = await db.appConfig.count();
        if (configCount === 0) {
            // App Config
            await db.appConfig.add({
                id: 'singleton',
                defaultCurrency: 'COP',
                minConfidenceThreshold: 0.7,
                enableAISuggestions: true
            });
        }

        // Always seed tags if empty (Phase 2)
        await seedTags();

        // Always seed quick templates if empty
        await seedQuickTemplates();
    });

    // Cleanup duplicates (Self-correcting)
    await cleanupDuplicates();
};

const cleanupDuplicates = async () => {
    await db.transaction('rw', db.categories, db.accounts, async () => {
        // 1. Cleanup Categories
        const categories = await db.categories.toArray();
        const seenCats = new Set<string>();
        const dupCats: string[] = [];

        for (const cat of categories) {
            const key = `${cat.name}-${cat.type}-${cat.parentId || 'root'}`;
            if (seenCats.has(key)) {
                dupCats.push(cat.id);
            } else {
                seenCats.add(key);
            }
        }

        if (dupCats.length > 0) {
            await db.categories.bulkDelete(dupCats);
            console.log(`Removed ${dupCats.length} duplicate categories.`);
        }

        // 2. Cleanup Accounts
        const accounts = await db.accounts.toArray();
        const seenAccts = new Set<string>();
        const dupAccts: string[] = [];

        for (const acct of accounts) {
            const key = acct.name.trim().toLowerCase(); // Normalize to catch "Efectivo " vs "Efectivo"
            if (seenAccts.has(key)) {
                dupAccts.push(acct.id);
            } else {
                seenAccts.add(key);
            }
        }

        if (dupAccts.length > 0) {
            await db.accounts.bulkDelete(dupAccts);
            console.log(`Removed ${dupAccts.length} duplicate accounts.`);
        }
    });
};

const DEFAULT_TAGS = [
    // Personas
    { name: 'Sofía', color: '#EC4899' },
    { name: 'Familia', color: '#8B5CF6' },

    // Contexto
    { name: 'Urgente', color: '#EF4444' },
    { name: 'Recurrente', color: '#3B82F6' },
    { name: 'Regalo', color: '#F59E0B' },

    // Propósito
    { name: 'Salud', color: '#10B981' },
    { name: 'Educación', color: '#06B6D4' },
    { name: 'Trabajo', color: '#6366F1' },
];

export async function seedTags() {
    const existingTags = await db.tags.count();
    if (existingTags > 0) return;

    const tags = DEFAULT_TAGS.map(tag => ({
        ...tag,
        id: uuidv4(),
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
    }));

    await db.tags.bulkAdd(tags as any);
    console.log('✅ Tags iniciales creados');
}

export async function seedQuickTemplates() {
    const existingTemplates = await db.quickTemplates.count();
    if (existingTemplates > 0) return;

    const templates = [
        {
            id: uuidv4(),
            name: 'Supermercado',
            icon: '🛒',
            description: 'Compra semanal o diaria de víveres',
            amount: 50000,
            type: 'expense',
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: uuidv4(),
            name: 'Almuerzo',
            icon: '🍽️',
            description: 'Almuerzo ejecutivo o corrientazo',
            amount: 20000,
            type: 'expense',
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: uuidv4(),
            name: 'Transporte',
            icon: '🚗',
            description: 'Uber, Didi o transporte público',
            amount: 15000,
            type: 'expense',
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
    ];

    await db.quickTemplates.bulkAdd(templates as any);
    console.log('✅ Plantillas rápidas iniciales creadas');
}
