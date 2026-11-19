import { Component, inject, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SERVICE_TYPES } from '../../../core/api/api.types';
import { coverageClass } from '../../../core/coverage-class';
import { SERVICE_LABELS } from '../../../core/labels';
import { AnalysisStore } from '../analysis.store';
import { PriorityStore } from '../priority.store';

/** Planning priority: districts under 50 % in two or more services, worst first. */
@Component({
  selector: 'app-priority-list',
  imports: [DecimalPipe],
  templateUrl: './priority-list.html',
  styleUrl: './priority-list.scss',
})
export class PriorityList {
  protected readonly priority = inject(PriorityStore);
  protected readonly analysis = inject(AnalysisStore);
  readonly rowSelected = output<string>();
  protected readonly services = SERVICE_TYPES;
  protected readonly labels = SERVICE_LABELS;
  protected readonly classFor = coverageClass;
}
