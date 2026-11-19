import { Component, inject } from '@angular/core';
import { SERVICE_TYPES, ServiceType } from '../../../core/api/api.types';
import { COVERAGE_CLASSES } from '../../../core/coverage-class';
import { SERVICE_LABELS } from '../../../core/labels';
import { FACILITY_STYLE } from '../../../map/layers/facility-layer';
import { MapStore } from '../../../map/map.store';
import { AnalysisStore } from '../analysis.store';
import { PriorityStore } from '../priority.store';

/**
 * Compact glass legend: coverage classes (after an analysis) + one chip per facility type.
 * Every swatch uses the same token as the map renderer; facility chips double as toggles.
 */
@Component({
  selector: 'app-legend-chips',
  templateUrl: './legend-chips.html',
  styleUrl: './legend-chips.scss',
})
export class LegendChips {
  protected readonly store = inject(MapStore);
  protected readonly analysis = inject(AnalysisStore);
  protected readonly priority = inject(PriorityStore);
  protected readonly services = SERVICE_TYPES;
  protected readonly labels = SERVICE_LABELS;
  protected readonly style = FACILITY_STYLE;
  protected readonly classes = COVERAGE_CLASSES;

  protected isOn(s: ServiceType): boolean {
    return this.store.visibleServices().includes(s);
  }
}
