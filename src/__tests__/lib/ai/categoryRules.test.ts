import { describe, it, expect } from 'vitest';
import { matchCategoryRule } from '@/lib/ai/categoryRules';

describe('matchCategoryRule', () => {
  it('maps uber jardin sofia to Niños > Transporte', () => {
    const rule = matchCategoryRule('Uber jardín Sofía', 'expense');
    expect(rule?.parentName).toBe('Niños');
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

  it('excludes uber with jardin from Privado rule when Niños rule matches first', () => {
    const rule = matchCategoryRule('Uber jardín Sofía ida', 'expense');
    expect(rule?.parentName).toBe('Niños');
  });
});
