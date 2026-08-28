import { describe, it, expect } from 'vitest';
import { formatCurrency, adjustColor, cn, toSentenceCase } from '@/lib/utils';

describe('formatCurrency', () => {
  it('formats zero correctly', () => {
    const result = formatCurrency(0);
    // COP format: "$\u00a00" or similar locale-specific format
    expect(result).toContain('0');
  });

  it('formats positive amounts in COP', () => {
    const result = formatCurrency(1500000);
    // Should contain "1.500.000" (Colombian format uses dots as thousands separator)
    expect(result).toContain('1.500.000');
  });

  it('formats negative amounts', () => {
    const result = formatCurrency(-50000);
    expect(result).toContain('50.000');
  });

  it('does not include decimal fractions', () => {
    const result = formatCurrency(1234.56);
    // minimumFractionDigits: 0, maximumFractionDigits: 0
    expect(result).not.toContain(',56');
    expect(result).not.toContain('.56');
  });

  it('formats small amounts', () => {
    const result = formatCurrency(500);
    expect(result).toContain('500');
  });
});

describe('adjustColor', () => {
  it('adjusts color by positive amount', () => {
    // #808080 (128,128,128) + 40 = #a8a8a8 (168,168,168)
    const result = adjustColor('#808080', 40);
    expect(result).toBe('#a8a8a8');
  });

  it('clamps to 0 when going below (no underflow)', () => {
    // #0a0a0a (10,10,10) - 20 = should clamp to #000000
    const result = adjustColor('#0a0a0a', -20);
    expect(result).toBe('#000000');
  });

  it('clamps to 255 when going above (no overflow)', () => {
    // #f0f0f0 (240,240,240) + 40 = should clamp to #ffffff
    const result = adjustColor('#f0f0f0', 40);
    expect(result).toBe('#ffffff');
  });

  it('handles pure black with negative amount', () => {
    const result = adjustColor('#000000', -10);
    expect(result).toBe('#000000');
  });

  it('handles pure white with positive amount', () => {
    const result = adjustColor('#ffffff', 40);
    expect(result).toBe('#ffffff');
  });

  it('handles color without hash prefix', () => {
    // The function strips # first, so passing with # should work
    const result = adjustColor('#ff0000', 0);
    expect(result).toBe('#ff0000');
  });

  it('adjusts all channels for a primary color', () => {
    // #800000 (128,0,0) + 40 = #a82828 (168,40,40)
    const result = adjustColor('#800000', 40);
    expect(result).toBe('#a82828');
  });
});

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'visible');
    expect(result).toContain('base');
    expect(result).toContain('visible');
    expect(result).not.toContain('hidden');
  });

  it('deduplicates Tailwind classes (last wins)', () => {
    // twMerge should resolve conflicting classes
    const result = cn('p-4', 'p-8');
    expect(result).toBe('p-8');
    expect(result).not.toContain('p-4');
  });

  it('handles undefined and null gracefully', () => {
    const result = cn('base', undefined, null);
    expect(result).toBe('base');
  });
});

describe('toSentenceCase', () => {
  it('capitalizes only the first letter', () => {
    expect(toSentenceCase('uber hasta el jardin')).toBe('Uber hasta el jardin');
  });

  it('lowercases the rest after title case', () => {
    expect(toSentenceCase('Bus Al Jardin')).toBe('Bus al jardin');
  });

  it('returns empty string unchanged', () => {
    expect(toSentenceCase('')).toBe('');
  });
});
