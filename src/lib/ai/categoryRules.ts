/**
 * Reglas de categorización por palabras clave en la descripción.
 * Extensible: agregar entradas para comida, deudas, regalos, etc.
 */

export type CategoryRuleMatchMode = 'any' | 'all';

export interface CategoryKeywordRule {
    type: 'income' | 'expense';
    /** Grupos de palabras: cada grupo es un sinónimo/variante (ej. mama, mamá) */
    keywordGroups: string[][];
    /** Si 'all', debe coincidir al menos una palabra de cada grupo */
    matchMode?: CategoryRuleMatchMode;
    /** Palabras que anulan la regla si aparecen */
    excludeKeywordGroups?: string[][];
    parentName: string;
    subcategoryName?: string;
    confidence: number;
    reason: string;
}

/** Normaliza texto para comparación (minúsculas, sin acentos) */
export function normalizeForMatch(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

const GENERIC_CATEGORY_NAMES = new Set(['otros', 'otro', 'varios']);

/**
 * Compara nombres de categoría de forma laxa: acentos, "Público" vs "Transporte público", etc.
 * Nombres genéricos ("Otros") solo coinciden de forma exacta.
 */
export function categoryNamesAreSimilar(a: string, b: string, parentName?: string): boolean {
    const na = normalizeForMatch(a);
    const nb = normalizeForMatch(b);
    if (na === nb) return true;

    const stripParentPrefix = (name: string) => {
        if (!parentName) return name;
        const prefix = `${normalizeForMatch(parentName)} `;
        return name.startsWith(prefix) ? name.slice(prefix.length).trim() : name;
    };

    const sa = stripParentPrefix(na);
    const sb = stripParentPrefix(nb);
    if (sa === sb && sa.length > 0) return true;

    if (GENERIC_CATEGORY_NAMES.has(sa) || GENERIC_CATEGORY_NAMES.has(sb)) return false;

    if (sa.length >= 4 && sb.length >= 4 && (sa.includes(sb) || sb.includes(sa))) {
        return true;
    }

    return false;
}

function groupMatches(desc: string, group: string[]): boolean {
    return group.some((kw) => desc.includes(normalizeForMatch(kw)));
}

function ruleMatches(desc: string, rule: CategoryKeywordRule): boolean {
    const normalized = normalizeForMatch(desc);

    if (rule.excludeKeywordGroups?.some((g) => groupMatches(normalized, g))) {
        return false;
    }

    if (rule.matchMode === 'all') {
        return rule.keywordGroups.every((g) => groupMatches(normalized, g));
    }

    return rule.keywordGroups.some((g) => groupMatches(normalized, g));
}

export function matchCategoryRule(
    description: string,
    type: 'income' | 'expense'
): CategoryKeywordRule | null {
    const rules = CATEGORY_KEYWORD_RULES.filter((r) => r.type === type);
    const sorted = [...rules].sort((a, b) => {
        const scoreA = (a.matchMode === 'all' ? 100 : 0) + a.keywordGroups.length;
        const scoreB = (b.matchMode === 'all' ? 100 : 0) + b.keywordGroups.length;
        return scoreB - scoreA;
    });

    for (const rule of sorted) {
        if (ruleMatches(description, rule)) return rule;
    }
    return null;
}

/**
 * Palabras en la descripción → pistas de nombre en el árbol del usuario.
 * Así "declaración de renta" encaja en "Gastos financieros" aunque no coincidan las palabras.
 */
export const DESCRIPTION_CATEGORY_HINTS: { keywords: string[]; nameHints: string[] }[] = [
    {
        keywords: [
            'declaracion de renta',
            'declaracion renta',
            'impuesto de renta',
            'dian',
            'retefuente',
            'retencion en la fuente',
            'ica',
        ],
        nameHints: ['financier', 'tribut', 'renta', 'dian'],
    },
    {
        keywords: ['impuesto', 'impuestos', 'predial', 'iva'],
        nameHints: ['impuest', 'financier', 'tribut', 'propiedad'],
    },
    {
        keywords: ['arriendo', 'alquiler', 'hipoteca', 'administracion'],
        nameHints: ['vivienda', 'alquiler', 'arriendo', 'hipoteca'],
    },
    {
        keywords: [
            'jardin',
            'jardín',
            'guarderia',
            'guardería',
            'colegio',
            'escuela',
            'kinder',
            'hijo',
            'hija',
            'nene',
            'bebe',
            'bebé',
            'ruta',
            'pension escolar',
            'matricula',
        ],
        nameHints: ['niñ', 'hij', 'familia', 'educa', 'colegio', 'jardin', 'ruta', 'infant', 'guarder', 'estudio'],
    },
    {
        keywords: ['uber', 'didi', 'cabify', 'beat', 'taxi', 'transporte', 'pasaje', 'gasolina', 'combustible', 'peaje'],
        nameHints: ['transporte', 'ruta', 'movilidad', 'viaje', 'auto', 'vehiculo', 'gasolina'],
    },
];

export const CATEGORY_KEYWORD_RULES: CategoryKeywordRule[] = [
    // --- Tributario (Colombia): si el usuario no tiene categoría parecida, se ofrece crearla ---
    {
        type: 'expense',
        keywordGroups: [
            ['declaracion de renta'],
            ['declaracion renta'],
            ['impuesto de renta'],
            ['dian'],
            ['retefuente'],
            ['retencion en la fuente'],
        ],
        parentName: 'Gastos financieros',
        subcategoryName: 'Impuestos',
        confidence: 0.82,
        reason: 'Gasto tributario (declaración o impuestos)',
    },

    // --- Transporte escolar (catálogo genérico Niños, no nombres propios) ---
    {
        type: 'expense',
        keywordGroups: [
            ['jardin', 'jardín', 'guarderia', 'guardería', 'colegio'],
            ['transporte', 'uber', 'didi', 'ruta'],
        ],
        matchMode: 'all',
        parentName: 'Niños',
        subcategoryName: 'Transporte',
        confidence: 0.86,
        reason: 'Transporte escolar (jardín/colegio)',
    },

    // --- Transporte privado ---
    {
        type: 'expense',
        keywordGroups: [['uber'], ['didi'], ['cabify'], ['beat']],
        parentName: 'Transporte',
        subcategoryName: 'Privado',
        confidence: 0.85,
        reason: 'Transporte privado (Uber/Didi/etc.)',
    },

    // --- Transporte público ---
    {
        type: 'expense',
        keywordGroups: [
            ['bus'],
            ['transmilenio'],
            ['sitp'],
            ['metro'],
            ['transporte publico'],
            ['transporte público'],
        ],
        parentName: 'Transporte',
        subcategoryName: 'Transporte público',
        confidence: 0.9,
        reason: 'Transporte público detectado',
    },

    // --- Ingresos: apoyos familiares ---
    {
        type: 'income',
        keywordGroups: [
            ['mama'],
            ['mamá'],
            ['apoyo mama'],
            ['apoyo de mama'],
            ['apoyo mamá'],
            ['apoyo de mamá'],
            ['ayuda mama'],
            ['ayuda de mama'],
        ],
        parentName: 'Apoyos',
        subcategoryName: 'Ayuda familiar',
        confidence: 0.92,
        reason: 'Apoyo o ayuda familiar detectada',
    },

    // --- Salario / nómina ---
    {
        type: 'income',
        keywordGroups: [
            ['nomina'],
            ['nómina'],
            ['salario'],
            ['sueldo'],
            ['pago quincenal'],
            ['pago mensual'],
        ],
        parentName: 'Salario',
        subcategoryName: 'Nómina',
        confidence: 0.9,
        reason: 'Ingreso por salario/nómina',
    },

    // --- Freelance ---
    {
        type: 'income',
        keywordGroups: [
            ['freelance'],
            ['freelancer'],
            ['honorarios'],
            ['consultoria'],
            ['consultoría'],
            ['proyecto'],
        ],
        parentName: 'Freelance',
        confidence: 0.85,
        reason: 'Ingreso por trabajo independiente',
    },

    // --- Gastos frecuentes (extensible) ---
    {
        type: 'expense',
        keywordGroups: [['supermercado'], ['exito'], ['carulla'], ['d1'], ['jumbo'], ['olimpica'], ['olímpica']],
        parentName: 'Gastos diarios',
        subcategoryName: 'Supermercado',
        confidence: 0.88,
        reason: 'Compra de supermercado',
    },
    {
        type: 'expense',
        keywordGroups: [['restaurante'], ['almuerzo'], ['cena'], ['domicilio'], ['rappi'], ['ifood']],
        parentName: 'Gastos diarios',
        subcategoryName: 'Restaurantes',
        confidence: 0.85,
        reason: 'Gasto en comida/restaurante',
    },
    {
        type: 'expense',
        keywordGroups: [['tarjeta de credito'], ['tarjeta crédito'], ['cuota tarjeta'], ['pago tarjeta']],
        parentName: 'Deuda',
        subcategoryName: 'Tarjeta de crédito',
        confidence: 0.88,
        reason: 'Pago de deuda con tarjeta',
    },
    {
        type: 'expense',
        keywordGroups: [['prestamo'], ['préstamo'], ['credito personal'], ['crédito personal']],
        parentName: 'Deuda',
        confidence: 0.85,
        reason: 'Pago de préstamo/deuda',
    },
    {
        type: 'expense',
        keywordGroups: [['regalo'], ['obsequio']],
        parentName: 'Regalos',
        confidence: 0.85,
        reason: 'Gasto en regalo',
    },
    {
        type: 'expense',
        keywordGroups: [['netflix'], ['spotify'], ['suscripcion'], ['suscripción'], ['disney']],
        parentName: 'Gastos diarios',
        subcategoryName: 'Suscripciones',
        confidence: 0.9,
        reason: 'Suscripción detectada',
    },
];
