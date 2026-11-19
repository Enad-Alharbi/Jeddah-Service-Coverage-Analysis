import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DISTANCES, Distance, SERVICE_TYPES, ServiceType } from '../../../core/api/api.types';
import { SERVICE_LABELS } from '../../../core/labels';
import { MapStore } from '../../../map/map.store';
import { AnalysisStore } from '../analysis.store';
import { WhatIfStore } from '../what-if.store';

/**
 * Top floating glass bar: app name, segmented controls (service, walking distance) and «تحليل».
 * After the first analysis, changing a setting re-runs it straight away.
 */
@Component({
  selector: 'app-command-bar',
  imports: [ReactiveFormsModule],
  templateUrl: './command-bar.html',
  styleUrl: './command-bar.scss',
})
export class CommandBar {
  protected readonly analysis = inject(AnalysisStore);
  protected readonly map = inject(MapStore);
  protected readonly whatIf = inject(WhatIfStore);
  protected readonly services = SERVICE_TYPES;
  protected readonly distances = DISTANCES;
  protected readonly labels = SERVICE_LABELS;
  /** Small screens: the controls collapse behind a menu button. */
  protected readonly menuOpen = signal(false);

  protected readonly form = new FormGroup({
    service: new FormControl<ServiceType>(this.analysis.service(), { nonNullable: true }),
    distance: new FormControl<Distance>(this.analysis.distance(), { nonNullable: true }),
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((v) => {
      this.analysis.service.set(v.service!);
      this.analysis.distance.set(Number(v.distance) as Distance);
      if (this.analysis.result()) void this.analysis.analyze();
    });
  }

  protected run(): void {
    this.menuOpen.set(false);
    void this.analysis.analyze();
  }

  protected toggleProposal(): void {
    this.menuOpen.set(false);
    if (this.whatIf.mode()) this.whatIf.exit();
    else this.whatIf.enter();
  }
}
