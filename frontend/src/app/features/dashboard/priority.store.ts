import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CoverageApi } from '../../core/api/coverage-api.service';
import { Distance, PriorityResponse } from '../../core/api/api.types';
import { COVERAGE_BREAKS } from '../../core/coverage-class';
import { Status } from './analysis.store';

export type DrawerTab = 'ranking' | 'priority';

/**
 * Multi-service view: residential districts under 50 % in two or more services.
 * Independent of the selected service (it always looks at all three), dependent on the walking distance.
 */
@Injectable()
export class PriorityStore {
  private readonly api = inject(CoverageApi);
  private requestId = 0;

  readonly tab = signal<DrawerTab>('ranking');
  readonly status = signal<Status>('idle');
  readonly result = signal<PriorityResponse | null>(null);
  readonly threshold = COVERAGE_BREAKS.mid;

  readonly active = computed(() => this.tab() === 'priority');
  readonly allThree = computed(() => this.result()?.districts.filter((d) => d.underServedCount === 3).length ?? 0);

  async load(distance: Distance): Promise<void> {
    if (this.result()?.distanceM === distance && this.status() === 'ready') return;
    const id = ++this.requestId;
    this.status.set('loading');
    try {
      const r = await firstValueFrom(this.api.priority(distance, this.threshold));
      if (id !== this.requestId) return;
      this.result.set(r);
      this.status.set('ready');
    } catch {
      if (id === this.requestId) this.status.set('error');
    }
  }
}
