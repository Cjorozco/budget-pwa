import type { CategoryKeywordRule } from './categoryRules';

/**
 * Local rules for Canada: English and French keywords and Canadian merchants. Loaded only when the
 * active region is Canada, and checked before the base (Colombian/Spanish) rules.
 *
 * They point at the default seeded categories, which are still created in Spanish, so the
 * targets (parentName / subcategoryName) are Spanish. Reasons are Spanish too, like the rest of
 * the local engine. Matching is by whole word: "bell" or "cra" must not fire inside other words.
 */
type CaRule = Omit<CategoryKeywordRule, 'wholeWord'>;

const rule = (r: CaRule): CategoryKeywordRule => ({ ...r, wholeWord: true });

export const CA_KEYWORD_RULES: CategoryKeywordRule[] = [
    // ---------- Expenses ----------
    rule({
        type: 'expense',
        keywordGroups: [
            ['loblaws'], ['no frills'], ['sobeys'], ['iga'], ['superstore'], ['farm boy'], ['food basics'],
            ['freshco'], ['save-on-foods'], ['save on foods'], ['maxi'], ['provigo'],
            ['grocery'], ['groceries'], ['epicerie'], ['supermarket'], ['supermarche'],
        ],
        parentName: 'Gastos diarios',
        subcategoryName: 'Supermercado',
        confidence: 0.88,
        reason: 'Compra de supermercado',
    }),
    rule({
        type: 'expense',
        keywordGroups: [
            ['tim hortons'], ['tims'], ['second cup'], ['starbucks'], ['harveys'], ['swiss chalet'], ['boston pizza'],
            ['mcdonalds'], ['subway'], ['restaurant'], ['resto'], ['lunch'], ['dinner'], ['souper'],
            ['dejeuner'], ['diner'], ['coffee'], ['cafe'], ['uber eats'], ['ubereats'], ['doordash'],
            ['skipthedishes'], ['skip the dishes'],
        ],
        parentName: 'Gastos diarios',
        subcategoryName: 'Restaurantes',
        confidence: 0.85,
        reason: 'Gasto en comida o restaurante',
    }),
    rule({
        type: 'expense',
        keywordGroups: [
            ['shoppers drug mart'], ['jean coutu'], ['rexall'], ['pharmaprix'], ['london drugs'],
            ['pharmacy'], ['pharmacie'], ['prescription'], ['ordonnance'],
        ],
        parentName: 'Salud/médicos',
        subcategoryName: 'Farmacia',
        confidence: 0.88,
        reason: 'Compra en farmacia',
    }),
    rule({
        type: 'expense',
        keywordGroups: [
            ['petro-canada'], ['petro canada'], ['esso'], ['shell'], ['husky'], ['ultramar'],
            ['gas station'], ['gasoline'], ['essence'], ['carburant'], ['fuel'],
        ],
        parentName: 'Transporte',
        subcategoryName: 'Combustible',
        confidence: 0.88,
        reason: 'Combustible para el vehículo',
    }),
    rule({
        type: 'expense',
        keywordGroups: [
            ['ttc'], ['stm'], ['opus'], ['presto'], ['go transit'], ['oc transpo'], ['translink'], ['compass card'],
            ['transit'], ['bus pass'], ['metropass'], ['laissez-passer'], ['autobus'],
        ],
        parentName: 'Transporte',
        subcategoryName: 'Transporte público',
        confidence: 0.9,
        reason: 'Transporte público detectado',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['uber'], ['lyft'], ['taxi'], ['cab']],
        excludeKeywordGroups: [['eats'], ['ubereats']],
        parentName: 'Transporte',
        subcategoryName: 'Privado',
        confidence: 0.85,
        reason: 'Taxi o transporte privado',
    }),
    rule({
        type: 'expense',
        keywordGroups: [
            ['hydro one'], ['hydro-quebec'], ['hydro quebec'], ['toronto hydro'], ['bc hydro'], ['hydro ottawa'],
            ['epcor'], ['electricity'], ['electricite'], ['hydro'],
        ],
        parentName: 'Servicios básicos',
        subcategoryName: 'Electricidad',
        confidence: 0.9,
        reason: 'Servicio de electricidad',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['enbridge'], ['fortisbc'], ['energir'], ['natural gas'], ['gaz naturel'], ['chauffage']],
        parentName: 'Servicios básicos',
        subcategoryName: 'Calefacción o gas',
        confidence: 0.88,
        reason: 'Servicio de gas o calefacción',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['water bill'], ['water utility'], ['eau']],
        parentName: 'Servicios básicos',
        subcategoryName: 'Agua',
        confidence: 0.85,
        reason: 'Servicio de agua',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['internet'], ['wifi'], ['shaw'], ['cogeco'], ['videotron'], ['cable']],
        parentName: 'Servicios básicos',
        subcategoryName: 'Cable/Internet',
        confidence: 0.88,
        reason: 'Internet o cable',
    }),
    rule({
        type: 'expense',
        keywordGroups: [
            ['rogers'], ['bell'], ['telus'], ['koodo'], ['fido'], ['freedom mobile'], ['virgin plus'],
            ['cell phone'], ['phone bill'], ['cellulaire'], ['forfait'],
        ],
        excludeKeywordGroups: [['taco bell']],
        parentName: 'Servicios básicos',
        subcategoryName: 'Teléfono/Celular',
        confidence: 0.82,
        reason: 'Teléfono o celular',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['rent'], ['loyer'], ['mortgage'], ['hypotheque'], ['condo fees'], ['frais de copropriete']],
        parentName: 'Vivienda',
        subcategoryName: 'Alquiler o hipoteca',
        confidence: 0.9,
        reason: 'Alquiler o hipoteca',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['property tax'], ['taxe fonciere'], ['taxes municipales']],
        parentName: 'Vivienda',
        subcategoryName: 'Impuestos a la propiedad',
        confidence: 0.9,
        reason: 'Impuesto a la propiedad',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['netflix'], ['spotify'], ['disney'], ['crave'], ['prime video'], ['apple music'], ['subscription'], ['abonnement']],
        parentName: 'Gastos diarios',
        subcategoryName: 'Suscripciones',
        confidence: 0.9,
        reason: 'Suscripción detectada',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['insurance'], ['assurance']],
        parentName: 'Seguros',
        confidence: 0.85,
        reason: 'Pago de seguro',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['gym'], ['fitness'], ['goodlife'], ['planet fitness'], ['ymca']],
        parentName: 'Ocio',
        subcategoryName: 'Deporte',
        confidence: 0.85,
        reason: 'Gimnasio o deporte',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['cra'], ['canada revenue'], ['revenu quebec'], ['income tax'], ['impot']],
        parentName: 'Gastos financieros',
        subcategoryName: 'Impuestos',
        confidence: 0.82,
        reason: 'Impuestos',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['credit card'], ['carte de credit']],
        parentName: 'Deuda',
        subcategoryName: 'Tarjeta de crédito',
        confidence: 0.88,
        reason: 'Pago de deuda con tarjeta',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['loan payment'], ['student loan'], ['osap'], ['line of credit']],
        parentName: 'Deuda',
        confidence: 0.85,
        reason: 'Pago de préstamo o deuda',
    }),
    rule({
        type: 'expense',
        keywordGroups: [['gift'], ['cadeau'], ['donation']],
        parentName: 'Regalos',
        confidence: 0.85,
        reason: 'Gasto en regalo o donación',
    }),

    // ---------- Income ----------
    rule({
        type: 'income',
        keywordGroups: [['paycheque'], ['paycheck'], ['payroll'], ['salary'], ['salaire'], ['paie'], ['direct deposit']],
        parentName: 'Salario',
        subcategoryName: 'Nómina',
        confidence: 0.9,
        reason: 'Ingreso por salario',
    }),
    rule({
        type: 'income',
        keywordGroups: [['bonus']],
        parentName: 'Salario',
        subcategoryName: 'Bonificaciones',
        confidence: 0.88,
        reason: 'Bonificación laboral',
    }),
    rule({
        type: 'income',
        keywordGroups: [['freelance'], ['invoice paid'], ['client payment'], ['contract work']],
        parentName: 'Freelance',
        subcategoryName: 'Proyectos',
        confidence: 0.85,
        reason: 'Ingreso por trabajo independiente',
    }),
    rule({
        type: 'income',
        keywordGroups: [['ccb'], ['canada child benefit'], ['gst credit'], ['hst credit'], ['employment insurance'], ['allocation familiale']],
        parentName: 'Apoyos',
        confidence: 0.85,
        reason: 'Apoyo o beneficio del gobierno',
    }),
    rule({
        type: 'income',
        keywordGroups: [['interest'], ['interets']],
        parentName: 'Otros',
        subcategoryName: 'Ingresos por intereses',
        confidence: 0.85,
        reason: 'Ingreso por intereses',
    }),
    rule({
        type: 'income',
        keywordGroups: [['refund'], ['reimbursement'], ['remboursement']],
        parentName: 'Otros',
        subcategoryName: 'Reembolsos',
        confidence: 0.85,
        reason: 'Reembolso',
    }),
];

/** Canadian merchants the history matcher should recognize (see KNOWN_ESTABLISHMENTS). */
export const CA_KNOWN_ESTABLISHMENTS = [
    'tim hortons', 'loblaws', 'no frills', 'sobeys', 'shoppers drug mart', 'jean coutu', 'petro-canada',
    'canadian tire', 'rogers', 'telus', 'presto', 'uber', 'lyft', 'netflix', 'spotify', 'costco', 'walmart',
    'skipthedishes', 'doordash', 'uber eats', 'esso', 'shell',
];
