import { Injectable, computed, signal } from '@angular/core';
import { SERVICE_TYPES, ServiceType } from '../core/api/api.types';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Map UI state shared by the map, the legend and (later) the command bar. Provided per dashboard page. */
@Injectable()
export class MapStore {
  readonly loadState = signal<LoadState>('idle');
  readonly errorMessage = signal<string | null>(null);

  readonly districtCount = signal(0);
  readonly facilityCounts = signal<Record<ServiceType, number>>({ school: 0, health: 0, park: 0 });
  readonly visibleServices = signal<ServiceType[]>([...SERVICE_TYPES]);
  /** Live height of the bottom drawer (px): floating UI and map controls stay above it. */
  readonly drawerHeight = signal(48);

  readonly totalFacilities = computed(() => Object.values(this.facilityCounts()).reduce((a, b) => a + b, 0));

  toggleService(s: ServiceType): void {
    this.visibleServices.update((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  }
}
