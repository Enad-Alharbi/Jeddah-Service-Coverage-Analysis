import { coverageClass, coverageColorVar } from './coverage-class';

describe('coverageClass', () => {
  it('uses the three classes from the brief (< 50, 50–80, >= 80)', () => {
    expect(coverageClass(0)).toBe('low');
    expect(coverageClass(49.99)).toBe('low');
    expect(coverageClass(50)).toBe('mid');
    expect(coverageClass(79.99)).toBe('mid');
    expect(coverageClass(80)).toBe('high');
    expect(coverageClass(100)).toBe('high');
  });

  it('maps a percentage to the matching design token', () => {
    expect(coverageColorVar(10)).toBe('var(--coverage-low)');
    expect(coverageColorVar(65)).toBe('var(--coverage-mid)');
    expect(coverageColorVar(95)).toBe('var(--coverage-high)');
  });
});
