import { normalizeForMatch } from './categoryRules';

/**
 * Contrastive guidance per category for the LLM prompt: what it covers (`what`) and what it is
 * NOT for (`notFor`, pointing to the right alternative). Keyed by the normalized category path
 * ("Padre › Hijo", lowercase, no accents). Lives in code, not in the DB, so it needs no schema or
 * backup change. User-made categories simply have no entry and are judged by their name and by
 * the user's own transaction history.
 */
export interface CategoryCriteria {
    what: string;
    notFor?: string;
}

const GENERIC_LEAF_NAMES = new Set(['otros', 'otro', 'varios']);

const RAW_CRITERIA: Record<string, CategoryCriteria> = {
    // ===== Gastos =====
    'Niños': {
        what: 'gastos de hijos menores: colegio, guardería, ropa, juguetes, actividades',
        notFor: 'gastos de adultos; salud del propio usuario (Salud/médicos)',
    },
    'Niños › Ropa': { what: 'ropa y calzado de los niños', notFor: 'ropa del propio usuario (Gastos diarios › Ropa)' },
    'Niños › Transporte': { what: 'ruta escolar y transporte de los niños', notFor: 'transporte del propio usuario (Transporte)' },
    'Deuda': {
        what: 'pagos de tarjeta de crédito y préstamos, intereses y cuotas de deuda',
        notFor: 'compras hechas con tarjeta: van a la categoría del bien o servicio comprado',
    },
    'Educación': {
        what: 'matrículas, libros, cursos y plataformas de estudio del propio usuario',
        notFor: 'colegio o guardería de los hijos (Niños)',
    },
    'Ocio': {
        what: 'cine, salidas, deporte recreativo, juegos, rumba, vacaciones',
        notFor: 'comida del día a día (Gastos diarios › Restaurantes); billetes y hoteles de un viaje (Viajes)',
    },
    'Gastos diarios': {
        what: 'supermercado, restaurantes, higiene, ropa propia, suscripciones, snacks',
        notFor: 'servicios del hogar (Servicios básicos); transporte (Transporte)',
    },
    'Gastos diarios › Ropa': { what: 'ropa y calzado del propio usuario', notFor: 'ropa de los niños (Niños › Ropa)' },
    'Gastos diarios › Suscripciones': { what: 'streaming, música y membresías de entretenimiento', notFor: 'hosting, software o servicios online de trabajo (Tecnología)' },
    'Regalos': {
        what: 'regalos para otras personas y donativos',
        notFor: 'compras para uno mismo',
    },
    'Salud/médicos': {
        what: 'consultas, medicinas, farmacia y urgencias del propio usuario',
        notFor: 'primas de seguro (Seguros › Salud); salud de los niños (Niños › Gastos médicos); veterinario (Mascotas)',
    },
    'Vivienda': {
        what: 'arriendo o hipoteca, muebles, mantenimiento, mudanza, impuesto de la propiedad',
        notFor: 'agua, luz, gas e internet (Servicios básicos)',
    },
    'Seguros': {
        what: 'primas de seguros de vehículo, salud, hogar y vida',
        notFor: 'gastos médicos o reparaciones: son el servicio, no el seguro',
    },
    'Mascotas': {
        what: 'comida, veterinario, juguetes y suministros de mascotas',
    },
    'Tecnología': {
        what: 'dominios, hosting, software, hardware y servicios online',
        notFor: 'streaming y entretenimiento (Gastos diarios › Suscripciones)',
    },
    'Transporte': {
        what: 'combustible, taxis y apps de transporte, transporte público, reparaciones y pagos del vehículo',
        notFor: 'billetes de avión y hoteles (Viajes); transporte de los niños (Niños › Transporte)',
    },
    'Viajes': {
        what: 'billetes de avión, hoteles y gastos durante un viaje',
        notFor: 'transporte cotidiano (Transporte)',
    },
    'Servicios básicos': {
        what: 'agua, electricidad, gas, internet y celular',
        notFor: 'arriendo o hipoteca (Vivienda)',
    },
    // ===== Ingresos =====
    'Salario': { what: 'nómina, bonificaciones, comisiones y propinas de un empleo', notFor: 'trabajo por proyectos (Freelance)' },
    'Freelance': { what: 'ingresos por proyectos y consultoría independiente', notFor: 'nómina de un empleo (Salario)' },
    'Apoyos': { what: 'ayuda de familiares u otros apoyos', notFor: 'pagos por trabajo (Salario o Freelance)' },
};

const CRITERIA: Map<string, CategoryCriteria> = new Map(
    Object.entries(RAW_CRITERIA).map(([path, value]) => [normalizeForMatch(path), value])
);

/** Normalized paths that have an entry (used by tests to catch keys that drifted from the seed). */
export const CATEGORY_CRITERIA_PATHS: readonly string[] = [...CRITERIA.keys()];

/** Criteria for a category path, or a generic hint for "Otros" leaves, or null. */
export function getCategoryCriteria(path: string): CategoryCriteria | null {
    const key = normalizeForMatch(path);
    const direct = CRITERIA.get(key);
    if (direct) return direct;

    const leafName = key.split(' › ').pop() ?? key;
    if (key.includes(' › ') && GENERIC_LEAF_NAMES.has(leafName)) {
        return { what: 'solo si ninguna subcategoría específica del mismo padre encaja' };
    }
    return null;
}
