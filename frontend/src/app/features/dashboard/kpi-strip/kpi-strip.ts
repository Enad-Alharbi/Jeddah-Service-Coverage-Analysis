import { Component, computed, inject } from '@angular/core';
import { SERVICE_LABELS } from '../../../core/labels';
import { coverageColorVar } from '../../../core/coverage-class';
import { CountUpDirective } from '../../../shared/count-up.directive';
import { AnalysisStore } from '../analysis.store';

/** City-wide KPIs for the current analysis (residential districts only). */
@Component({
  selector: 'app-kpi-strip',
  imports: [CountUpDirective],
  templateUrl: './kpi-strip.html',
  styleUrl: './kpi-strip.scss',
})
export class KpiStrip {
  protected readonly analysis = inject(AnalysisStore);
  protected readonly summary = computed(() => this.analysis.result()?.summary ?? null);
  protected readonly serviceLabel = computed(() => {
    const r = this.analysis.result();
    return r ? `${SERVICE_LABELS[r.serviceType]} · ${r.distanceM} م` : '';
  });
  protected readonly cityColor = computed(() => coverageColorVar(this.summary()?.cityCoveragePct ?? 0));
}
