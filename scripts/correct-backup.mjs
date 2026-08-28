/**
 * Genera budget-backup-corrected-YYYY-MM-DD.json a partir del backup exportado.
 * Uso: node scripts/correct-backup.mjs budget-backup-2026-08-28.json
 */
import fs from 'fs';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

const inputPath = process.argv[2] || 'budget-backup-2026-08-28.json';
const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const backup = structuredClone(raw);

const { categories, transactions, tags } = backup.tables;

const catById = new Map(categories.map((c) => [c.id, c]));
const catByPath = (type, parentName, subName) => {
  const parent = categories.find(
    (c) => c.type === type && !c.parentId && c.name.toLowerCase() === parentName.toLowerCase()
  );
  if (!subName) return parent;
  return categories.find(
    (c) =>
      c.type === type &&
      c.parentId === parent?.id &&
      c.name.toLowerCase().trim() === subName.toLowerCase().trim()
  );
};

function ensureCategory(type, parentName, subName, color, parentColor) {
  let parent = categories.find(
    (c) => c.type === type && !c.parentId && c.name === parentName
  );
  if (!parent) {
    parent = {
      id: uuidv4(),
      name: parentName,
      type,
      color: parentColor || (type === 'income' ? '#f59e0b' : '#ec4899'),
      usageCount: 0,
      isActive: true,
    };
    categories.push(parent);
    catById.set(parent.id, parent);
  }

  if (!subName) return parent.id;

  let child = categories.find(
    (c) => c.parentId === parent.id && c.name === subName
  );
  if (!child) {
    child = {
      id: uuidv4(),
      name: subName,
      type,
      color: color || parent.color,
      parentId: parent.id,
      usageCount: 0,
      isActive: true,
    };
    categories.push(child);
    catById.set(child.id, child);
  }
  return child.id;
}

// --- 1. Renombrar Sueldo → Salario ---
const sueldo = categories.find((c) => c.type === 'income' && c.name === 'Sueldo' && !c.parentId);
if (sueldo) sueldo.name = 'Salario';

// --- 2. Apoyos > Ayuda familiar (migrar Otros > Mamá) ---
const apoyosId = ensureCategory('income', 'Apoyos', undefined, '#f59e0b');
const mamaSub = categories.find((c) => c.id === '95a06d5f-b7a1-45a7-ac0b-938973347100' || c.name === 'Mamá');
if (mamaSub) {
  mamaSub.parentId = apoyosId;
  mamaSub.name = 'Ayuda familiar';
}

// --- 3. Sofia > Transporte ---
const sofiaParent = categories.find((c) => c.name === 'Sofia' && c.type === 'expense' && !c.parentId);
const sofiaTransporteId = sofiaParent
  ? ensureCategory('expense', 'Sofia', 'Transporte', '#ec4899')
  : null;

const sofiaJardinSub = categories.find(
  (c) => c.parentId === sofiaParent?.id && c.name.trim() === 'Jardín'
);
const jardinParent = categories.find((c) => c.name === 'Jardín' && !c.parentId && c.type === 'expense');

const jardinTagId = tags.find((t) => t.name === 'Jardín')?.id;

let reassigned = { sofiaTransporte: 0, sofiaJardin: 0, tagsCleared: 0 };

for (const tx of transactions) {
  const originalTagIds = raw.tables.transactions.find((r) => r.id === tx.id)?.tagIds || [];

  if (tx.type !== 'transfer') {
    // Uber/Bus con tag Jardín → Sofia > Transporte
    if (
      sofiaTransporteId &&
      jardinTagId &&
      originalTagIds.includes(jardinTagId)
    ) {
      tx.categoryId = sofiaTransporteId;
      reassigned.sofiaTransporte++;
    } else if (jardinParent && tx.categoryId === jardinParent.id && sofiaJardinSub) {
      tx.categoryId = sofiaJardinSub.id;
      reassigned.sofiaJardin++;
    }
  }

  if (tx.tagIds?.length) {
    tx.tagIds = [];
    reassigned.tagsCleared++;
  }
}

// Desactivar categorías vacías / redundantes
const deactivateNames = [
  'Bus',
  'Uber/Didi',
  'Alcohol',
];
for (const c of categories) {
  const parent = c.parentId ? catById.get(c.parentId) : null;
  const label = parent ? `${parent.name} > ${c.name}` : c.name;
  const txCount = transactions.filter((t) => t.categoryId === c.id && t.type !== 'transfer').length;
  if (
    txCount === 0 &&
    (deactivateNames.includes(c.name.trim()) ||
      (c.name === 'Jardín' && !c.parentId) ||
      c.name === 'Otros' && c.type === 'expense')
  ) {
    c.isActive = false;
  }
}

if (jardinParent) jardinParent.isActive = false;

// Vaciar tags (ya no se usan)
backup.tables.tags = [];

backup.timestamp = Date.now();
const outName = inputPath.replace('.json', '-corrected.json');
fs.writeFileSync(outName, JSON.stringify(backup, null, 2));

console.log('Written:', outName);
console.log('Reassigned:', reassigned);
console.log('Categories:', categories.filter((c) => c.isActive).length, 'active');
