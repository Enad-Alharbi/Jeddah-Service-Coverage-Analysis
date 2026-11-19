import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Animates a number from its previous value to the new one (≈ 600 ms, ease-out).
 * Shows the final value immediately when the user prefers reduced motion.
 */
@Directive({ selector: '[appCountUp]' })
export class CountUpDirective {
  readonly appCountUp = input.required<number>();
  readonly decimals = input(0);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private current = 0;
  private frame = 0;
  private readonly format = (v: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: this.decimals(), maximumFractionDigits: this.decimals() });

  constructor() {
    effect(() => this.animateTo(this.appCountUp()));
  }

  private animateTo(target: number): void {
    cancelAnimationFrame(this.frame);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = this.current;
    if (reduce || from === target) {
      this.current = target;
      this.el.textContent = this.format(target);
      return;
    }
    const start = performance.now();
    const duration = 600;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.current = from + (target - from) * eased;
      this.el.textContent = this.format(this.current);
      if (t < 1) this.frame = requestAnimationFrame(step);
      else this.current = target;
    };
    this.frame = requestAnimationFrame(step);
  }
}
