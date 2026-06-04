import { describe, it, expect } from 'vitest';
import { levenshtein, tokenize } from '@/lib/ai/categorizer';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('netflix', 'netflix')).toBe(0);
  });

  it('returns correct distance for single deletion', () => {
    // "netflx" is "netflix" with 'i' removed -> distance 1
    expect(levenshtein('netflx', 'netflix')).toBe(1);
  });

  it('returns correct distance for single insertion', () => {
    expect(levenshtein('netflix', 'netflx')).toBe(1);
  });

  it('returns correct distance for substitution', () => {
    // "nxtflix" -> 'e' replaced with 'x' -> distance 1
    expect(levenshtein('nxtflix', 'netflix')).toBe(1);
  });

  it('returns length of b when a is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
  });

  it('returns length of a when b is empty', () => {
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('handles completely different strings', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });

  it('handles common typos in establishments', () => {
    // "spotfy" -> "spotify" = distance 1 (missing 'i')
    expect(levenshtein('spotfy', 'spotify')).toBeLessThanOrEqual(2);
  });

  it('handles case-sensitive comparison', () => {
    // The function is case-sensitive; caller normalizes
    expect(levenshtein('Netflix', 'netflix')).toBe(1);
  });
});

describe('tokenize', () => {
  it('removes accents and lowercases', () => {
    const tokens = tokenize('Bogotá');
    expect(tokens).toContain('bogota');
  });

  it('removes stop words', () => {
    const tokens = tokenize('Pago de Uber en Bogotá');
    expect(tokens).not.toContain('pago');
    expect(tokens).not.toContain('de');
    expect(tokens).not.toContain('en');
  });

  it('keeps meaningful words', () => {
    const tokens = tokenize('Pago de Uber en Bogotá');
    expect(tokens).toContain('uber');
    expect(tokens).toContain('bogota');
  });

  it('filters words with 2 or fewer characters', () => {
    const tokens = tokenize('El yo tu');
    expect(tokens).toHaveLength(0);
  });

  it('returns empty array for only stop words', () => {
    const tokens = tokenize('el la los las un una');
    expect(tokens).toHaveLength(0);
  });

  it('handles special characters', () => {
    const tokens = tokenize('Netflix $15.99 (mensual)');
    expect(tokens).toContain('netflix');
    expect(tokens).toContain('mensual');
  });

  it('splits on multiple spaces', () => {
    const tokens = tokenize('uber   eats   bogota');
    expect(tokens).toContain('uber');
    expect(tokens).toContain('eats');
    expect(tokens).toContain('bogota');
  });

  it('handles empty string', () => {
    const tokens = tokenize('');
    expect(tokens).toHaveLength(0);
  });
});
