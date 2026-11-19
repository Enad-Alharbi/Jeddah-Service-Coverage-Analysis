import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { coverageColorVar } from '../../core/coverage-class';

const R = 26;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Small SVG donut for a coverage %, colored with the same class palette as the map. */
@Component({
  selector: 'app-donut-gauge',
  imports: [DecimalPipe],
  template: `
    <svg viewBox="0 0 64 64" role="img" [attr.aria-label]="label() + ': ' + (value() | number: '1.0-1') + '%'">
      <circle cx="32" cy="32" [attr.r]="r" class="track" />
      <circle
        cx="32" cy="32" [attr.r]="r" class="value"
        [attr.stroke]="color()"
        [attr.stroke-dasharray]="dash()"
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" text-anchor="middle" class="pct">{{ value() | number: '1.0-0' }}%</text>
    </svg>
    <span class="label">{{ label() }}</span>
  `,
  styles: `
    :host { display: grid; justify-items: center; gap: 4px; }
    svg { inline-size: 72px; block-size: 72px; }
    circle { fill: none; stroke-width: 7; stroke-linecap: round; }
    .track { stroke: var(--color-surface-2); }
    .value { transition: stroke-dasharray var(--duration-base) var(--easing); }
    .pct { fill: var(--color-text); font: 600 13px var(--font-heading); font-variant-numeric: tabular-nums; direction: ltr; }
    .label { font-size: 0.78rem; color: var(--color-text-muted); }
    @media (prefers-reduced-motion: reduce) { .value { transition: none; } }
  `,
})
export class DonutGauge {
  readonly value = input.required<number>();
  readonly label = input.required<string>();

  protected readonly r = R;
  protected readonly color = computed(() => coverageColorVar(this.value()));
  protected readonly dash = computed(() => {
    const filled = (Math.min(100, Math.max(0, this.value())) / 100) * CIRCUMFERENCE;
    return `${filled} ${CIRCUMFERENCE}`;
  });
}
