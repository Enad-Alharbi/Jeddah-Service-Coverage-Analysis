/**
 * The three coverage classes. ONE definition shared by the map renderer, the legend, the table badges and the
 * gauges, so a district is never "amber" on the map and "cyan" in the table.
 */
export type CoverageClass = 'low' | 'mid' | 'high';

export const COVERAGE_BREAKS = { mid: 50, high: 80 } as const;

export const COVERAGE_CLASSES: readonly {
  key: CoverageClass;
  label: string;
  token: string;
  min: number;
  max: number;
}[] = [
  { key: 'low', label: 'أقل من 50%', token: '--coverage-low', min: 0, max: COVERAGE_BREAKS.mid },
  { key: 'mid', label: '50% – 80%', token: '--coverage-mid', min: COVERAGE_BREAKS.mid, max: COVERAGE_BREAKS.high },
  { key: 'high', label: '80% فأكثر', token: '--coverage-high', min: COVERAGE_BREAKS.high, max: 100 },
];

export function coverageClass(pct: number): CoverageClass {
  if (pct >= COVERAGE_BREAKS.high) return 'high';
  if (pct >= COVERAGE_BREAKS.mid) return 'mid';
  return 'low';
}

/** CSS color for a percentage, e.g. for inline progress bars: `var(--coverage-low)`. */
export function coverageColorVar(pct: number): string {
  return `var(--coverage-${coverageClass(pct)})`;
}
