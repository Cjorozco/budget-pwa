import type { SupportedLanguage } from '@/lib/i18n/types';
import type { CurrencyCode } from '@/lib/region/region';
import type { Category } from '@/lib/types';

/**
 * Default categories are seeded in the UI language of the first run. Internally everything
 * (local rules, AI criteria, the evaluation set) still names them by their Spanish canonical
 * path, so each seeded category keeps it in `seedKey` ("Gastos diarios › Supermercado") and
 * lookups go through that key. Names are user data: switching the UI language later does not
 * rename them.
 *
 * The translations are a first draft and should get a native-speaker review.
 */
type Translation = { en: string; fr: string };

export const SEED_NAME_TRANSLATIONS: Record<string, Translation> = {
    // Income
    Salario: { en: 'Salary', fr: 'Salaire' },
    Freelance: { en: 'Freelance', fr: 'Pigiste' },
    Apoyos: { en: 'Support', fr: 'Soutien' },
    Otros: { en: 'Other', fr: 'Autres' },
    Nómina: { en: 'Payroll', fr: 'Paie' },
    Propinas: { en: 'Tips', fr: 'Pourboires' },
    Bonificaciones: { en: 'Bonuses', fr: 'Primes' },
    Comisiones: { en: 'Commissions', fr: 'Commissions' },
    Proyectos: { en: 'Projects', fr: 'Projets' },
    Consultoría: { en: 'Consulting', fr: 'Consultation' },
    'Ayuda familiar': { en: 'Family help', fr: 'Aide familiale' },
    'Ingresos por intereses': { en: 'Interest income', fr: 'Revenus d’intérêts' },
    Dividendos: { en: 'Dividends', fr: 'Dividendes' },
    Regalos: { en: 'Gifts', fr: 'Cadeaux' },
    Reembolsos: { en: 'Refunds', fr: 'Remboursements' },
    // Expense roots
    Niños: { en: 'Kids', fr: 'Enfants' },
    Deuda: { en: 'Debt', fr: 'Dettes' },
    Educación: { en: 'Education', fr: 'Éducation' },
    Ocio: { en: 'Leisure', fr: 'Loisirs' },
    'Gastos diarios': { en: 'Daily expenses', fr: 'Dépenses quotidiennes' },
    'Salud/médicos': { en: 'Health/medical', fr: 'Santé/médecins' },
    Vivienda: { en: 'Housing', fr: 'Logement' },
    Seguros: { en: 'Insurance', fr: 'Assurances' },
    Mascotas: { en: 'Pets', fr: 'Animaux' },
    Tecnología: { en: 'Technology', fr: 'Technologie' },
    Transporte: { en: 'Transportation', fr: 'Transport' },
    Viajes: { en: 'Travel', fr: 'Voyages' },
    'Servicios básicos': { en: 'Utilities', fr: 'Services publics' },
    // Kids
    Actividades: { en: 'Activities', fr: 'Activités' },
    'Cuota o básicos': { en: 'Fees and basics', fr: 'Frais et besoins de base' },
    'Gastos médicos': { en: 'Medical expenses', fr: 'Frais médicaux' },
    Guardería: { en: 'Daycare', fr: 'Garderie' },
    Ropa: { en: 'Clothing', fr: 'Vêtements' },
    Colegio: { en: 'School', fr: 'École' },
    Juguetes: { en: 'Toys', fr: 'Jouets' },
    // Debt
    'Tarjeta de crédito': { en: 'Credit card', fr: 'Carte de crédit' },
    'Préstamo personal': { en: 'Personal loan', fr: 'Prêt personnel' },
    'Préstamo estudiantil': { en: 'Student loan', fr: 'Prêt étudiant' },
    // Education
    Matrícula: { en: 'Tuition', fr: 'Frais de scolarité' },
    Libros: { en: 'Books', fr: 'Livres' },
    'Clases de música': { en: 'Music lessons', fr: 'Cours de musique' },
    Platzi: { en: 'Online courses', fr: 'Cours en ligne' },
    // Leisure
    Cine: { en: 'Movies', fr: 'Cinéma' },
    Citas: { en: 'Dates', fr: 'Sorties en couple' },
    'Conciertos o espectáculos': { en: 'Concerts or shows', fr: 'Concerts ou spectacles' },
    Deporte: { en: 'Sports', fr: 'Sports' },
    Juegos: { en: 'Games', fr: 'Jeux' },
    Rumba: { en: 'Nightlife', fr: 'Vie nocturne' },
    Vacaciones: { en: 'Vacation', fr: 'Vacances' },
    // Daily expenses
    'Higiene personal': { en: 'Personal hygiene', fr: 'Hygiène personnelle' },
    Laundry: { en: 'Laundry', fr: 'Buanderie' },
    Supermercado: { en: 'Groceries', fr: 'Épicerie' },
    'Peluquería o belleza': { en: 'Hair or beauty', fr: 'Coiffure ou beauté' },
    Restaurantes: { en: 'Restaurants', fr: 'Restaurants' },
    Suscripciones: { en: 'Subscriptions', fr: 'Abonnements' },
    'Snacks/⛽': { en: 'Snacks/⛽', fr: 'Collations/⛽' },
    // Gifts
    'Donativos (ONG)': { en: 'Donations (charity)', fr: 'Dons (organismes)' },
    // Health
    'Médicos (dentista/oculista)': { en: 'Doctors (dentist/optometrist)', fr: 'Médecins (dentiste/optométriste)' },
    Especialistas: { en: 'Specialists', fr: 'Spécialistes' },
    Farmacia: { en: 'Pharmacy', fr: 'Pharmacie' },
    Urgencias: { en: 'Emergency', fr: 'Urgences' },
    // Housing
    'Alquiler o hipoteca': { en: 'Rent or mortgage', fr: 'Loyer ou hypothèque' },
    'Artículos para el hogar': { en: 'Household items', fr: 'Articles ménagers' },
    'Césped o jardín': { en: 'Lawn and garden', fr: 'Pelouse et jardin' },
    'Impuestos a la propiedad': { en: 'Property tax', fr: 'Taxes foncières' },
    Mantenimiento: { en: 'Maintenance', fr: 'Entretien' },
    Mejoras: { en: 'Improvements', fr: 'Rénovations' },
    Mudanza: { en: 'Moving', fr: 'Déménagement' },
    Muebles: { en: 'Furniture', fr: 'Meubles' },
    // Insurance
    Vehículo: { en: 'Vehicle', fr: 'Véhicule' },
    Salud: { en: 'Health', fr: 'Santé' },
    Hogar: { en: 'Home', fr: 'Habitation' },
    Vida: { en: 'Life', fr: 'Vie' },
    // Pets
    Comida: { en: 'Food', fr: 'Nourriture' },
    'Veterinario o medicinas': { en: 'Vet or medicine', fr: 'Vétérinaire ou médicaments' },
    Suministros: { en: 'Supplies', fr: 'Fournitures' },
    // Technology
    'Dominios y alojamiento': { en: 'Domains and hosting', fr: 'Domaines et hébergement' },
    'Servicios online': { en: 'Online services', fr: 'Services en ligne' },
    Hardware: { en: 'Hardware', fr: 'Matériel' },
    Software: { en: 'Software', fr: 'Logiciels' },
    // Transport
    Privado: { en: 'Private transport', fr: 'Transport privé' },
    Combustible: { en: 'Fuel', fr: 'Carburant' },
    'Matriculación o permiso': { en: 'Registration or permit', fr: 'Immatriculation ou permis' },
    'Pagos del vehículo': { en: 'Vehicle payments', fr: 'Paiements du véhicule' },
    Reparaciones: { en: 'Repairs', fr: 'Réparations' },
    'Transporte público': { en: 'Public transit', fr: 'Transport en commun' },
    // Travel
    'Bebidas o Comidas': { en: 'Drinks or meals', fr: 'Boissons ou repas' },
    'Billetes de avión': { en: 'Flights', fr: 'Billets d’avion' },
    'Clothing, Shoes & Jewelry': { en: 'Clothing, Shoes & Jewelry', fr: 'Vêtements, chaussures et bijoux' },
    Hoteles: { en: 'Hotels', fr: 'Hôtels' },
    'Laundry & Pharmacy': { en: 'Laundry & Pharmacy', fr: 'Buanderie et pharmacie' },
    // Utilities
    Agua: { en: 'Water', fr: 'Eau' },
    'Cable/Internet': { en: 'Cable/Internet', fr: 'Câble/Internet' },
    'Calefacción o gas': { en: 'Heating or gas', fr: 'Chauffage ou gaz' },
    Electricidad: { en: 'Electricity', fr: 'Électricité' },
    'Teléfono/Celular': { en: 'Phone/Mobile', fr: 'Téléphone/Cellulaire' },
    // Not in the default seed, but targets of the local rules: created in the user's language too
    'Gastos financieros': { en: 'Financial expenses', fr: 'Dépenses financières' },
    Impuestos: { en: 'Taxes', fr: 'Impôts' },
    'Gastos personales': { en: 'Personal expenses', fr: 'Dépenses personnelles' },
    'Cuidado personal': { en: 'Personal care', fr: 'Soins personnels' },
    Antojos: { en: 'Treats', fr: 'Gâteries' },
    Café: { en: 'Coffee', fr: 'Café' },
    Servicios: { en: 'Services', fr: 'Services' },
    // Created by the balance-match flow
    'Ajuste de Reconciliación': { en: 'Balance adjustment', fr: 'Ajustement de solde' },
};

/** Name of a canonical (Spanish) category in a language; unknown names and Spanish stay as they are. */
export function seedNameFor(name: string, language: SupportedLanguage): string {
    if (language === 'es') return name;
    return SEED_NAME_TRANSLATIONS[name]?.[language] ?? name;
}

/** True when the name is one of the known canonical names (so it can be translated and keyed). */
export function isCanonicalSeedName(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(SEED_NAME_TRANSLATIONS, name);
}

/**
 * Stamps every seeded category with its canonical Spanish path (`seedKey`) and, for English or
 * French, translates the names. Works on the Spanish rows the seed declares, so Spanish stays
 * exactly as before apart from the extra `seedKey`.
 */
export function localizeSeedCategories(rows: Category[], language: SupportedLanguage): Category[] {
    const byId = new Map(rows.map((row) => [row.id, row]));
    return rows.map((row) => {
        const parent = row.parentId ? byId.get(row.parentId) : undefined;
        const seedKey = parent ? `${parent.name} › ${row.name}` : row.name;
        return { ...row, name: seedNameFor(row.name, language), seedKey };
    });
}

export interface QuickTemplateText {
    name: string;
    description: string;
}

const TEMPLATE_TEXTS: Record<SupportedLanguage, [QuickTemplateText, QuickTemplateText, QuickTemplateText]> = {
    es: [
        { name: 'Supermercado', description: 'Compra semanal o diaria de víveres' },
        { name: 'Almuerzo', description: 'Almuerzo ejecutivo o corrientazo' },
        { name: 'Transporte', description: 'Uber, Didi o transporte público' },
    ],
    en: [
        { name: 'Groceries', description: 'Weekly or daily grocery shopping' },
        { name: 'Lunch', description: 'Lunch at a restaurant or takeout' },
        { name: 'Transportation', description: 'Rideshare, taxi or public transit' },
    ],
    fr: [
        { name: 'Épicerie', description: 'Épicerie hebdomadaire ou quotidienne' },
        { name: 'Dîner', description: 'Repas au restaurant ou à emporter' },
        { name: 'Transport', description: 'Covoiturage, taxi ou transport en commun' },
    ],
};

/** Typical amounts in the currency's scale: 50,000 pesos is not a groceries run in dollars. */
const TEMPLATE_AMOUNTS: Record<CurrencyCode, [number, number, number]> = {
    COP: [50000, 20000, 15000],
    CAD: [100, 15, 6],
    USD: [100, 15, 6],
};

export function quickTemplateDefaults(language: SupportedLanguage, currency: CurrencyCode) {
    const texts = TEMPLATE_TEXTS[language];
    const amounts = TEMPLATE_AMOUNTS[currency];
    return [
        { ...texts[0], icon: '🛒', amount: amounts[0] },
        { ...texts[1], icon: '🍽️', amount: amounts[1] },
        { ...texts[2], icon: '🚗', amount: amounts[2] },
    ];
}
