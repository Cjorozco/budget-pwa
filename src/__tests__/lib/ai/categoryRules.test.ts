import { describe, it, expect } from 'vitest';
import { categoryNamesAreSimilar, matchCategoryRule } from '@/lib/ai/categoryRules';

describe('matchCategoryRule', () => {
  it('maps uber jardin sofia to Sofia > Transporte', () => {
    const rule = matchCategoryRule('Uber jardín Sofía', 'expense');
    expect(rule?.parentName).toBe('Sofia');
    expect(rule?.subcategoryName).toBe('Transporte');
  });

  it('maps uber hasta el jardin to Sofia > Transporte', () => {
    const rule = matchCategoryRule('Uber hasta el jardin', 'expense');
    expect(rule?.parentName).toBe('Sofia');
    expect(rule?.subcategoryName).toBe('Transporte');
  });

  it('maps uber alone to Transporte > Privado', () => {
    const rule = matchCategoryRule('Uber trabajo', 'expense');
    expect(rule?.parentName).toBe('Transporte');
    expect(rule?.subcategoryName).toBe('Privado');
  });

  it('maps bus to Transporte público', () => {
    const rule = matchCategoryRule('Bus transmilenio', 'expense');
    expect(rule?.subcategoryName).toBe('Transporte público');
  });

  it('maps bus al jardin to Transporte público (bus outranks jardin-only)', () => {
    const rule = matchCategoryRule('Bus al jardin', 'expense');
    expect(rule?.parentName).toBe('Transporte');
    expect(rule?.subcategoryName).toBe('Transporte público');
  });

  it('maps apoyo de mamá to Apoyos > Ayuda familiar', () => {
    const rule = matchCategoryRule('Apoyo de mamá', 'income');
    expect(rule?.parentName).toBe('Apoyos');
    expect(rule?.subcategoryName).toBe('Ayuda familiar');
  });

  it('maps nomina to Salario > Nómina', () => {
    const rule = matchCategoryRule('Pago nómina quincenal', 'income');
    expect(rule?.parentName).toBe('Salario');
    expect(rule?.subcategoryName).toBe('Nómina');
  });

  it('excludes uber with jardin from Privado', () => {
    const rule = matchCategoryRule('Uber jardín Sofía ida', 'expense');
    expect(rule?.parentName).toBe('Sofia');
  });
});

describe('categoryNamesAreSimilar', () => {
  it('matches Público with Transporte público under Transporte', () => {
    expect(categoryNamesAreSimilar('Público', 'Transporte público', 'Transporte')).toBe(true);
  });

  it('matches Publico without accent', () => {
    expect(categoryNamesAreSimilar('Publico', 'Transporte público', 'Transporte')).toBe(true);
  });

  it('matches Sofia and Sofía', () => {
    expect(categoryNamesAreSimilar('Sofia', 'Sofía')).toBe(true);
  });

  it('does not match generic Otros with a longer name', () => {
    expect(categoryNamesAreSimilar('Otros', 'Otros gastos')).toBe(false);
  });

  it('does not match unrelated names', () => {
    expect(categoryNamesAreSimilar('Privado', 'Transporte público', 'Transporte')).toBe(false);
  });
});
