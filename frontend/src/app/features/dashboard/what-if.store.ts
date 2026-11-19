import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProposalsApi } from '../../core/api/proposals-api.service';
import { Distance, Proposal, ServiceType } from '../../core/api/api.types';

export interface Trial {
  districtCode: string;
  nameAr: string;
  serviceType: ServiceType;
  distanceM: Distance;
  lon: number;
  lat: number;
  beforePct: number;
  afterPct: number;
  deltaPct: number;
  gainKm2: number;
}

/** What-if state: proposal mode, the current trial, saving, and the saved proposals. Provided per page. */
@Injectable()
export class WhatIfStore {
  private readonly api = inject(ProposalsApi);

  readonly mode = signal(false);
  readonly trial = signal<Trial | null>(null);
  /** The best trial in this session (highest gain), so the planner can compare spots. */
  readonly best = signal<Trial | null>(null);
  readonly message = signal<string | null>(null);

  readonly saving = signal(false);
  readonly lastSaved = signal<Proposal | null>(null);
  readonly saved = signal<Proposal[]>([]);

  enter(): void {
    this.mode.set(true);
    this.message.set(null);
  }

  exit(): void {
    this.mode.set(false);
    this.trial.set(null);
    this.best.set(null);
    this.lastSaved.set(null);
    this.message.set(null);
  }

  setTrial(t: Trial): void {
    this.trial.set(t);
    this.lastSaved.set(null);
    this.message.set(null);
    const b = this.best();
    if (!b || b.serviceType !== t.serviceType || b.distanceM !== t.distanceM || t.gainKm2 > b.gainKm2) this.best.set(t);
  }

  discard(): void {
    this.trial.set(null);
    this.lastSaved.set(null);
  }

  async save(note?: string): Promise<void> {
    const t = this.trial();
    if (!t || this.saving()) return;
    this.saving.set(true);
    try {
      const p = await firstValueFrom(
        this.api.create({
          serviceType: t.serviceType,
          distanceM: t.distanceM,
          districtCode: t.districtCode,
          lon: t.lon,
          lat: t.lat,
          clientCoverageAfter: Math.round(t.afterPct * 100) / 100,
          note,
        }),
      );
      this.lastSaved.set(p);
      this.saved.update((list) => [p, ...list]);
    } catch {
      this.message.set('تعذّر حفظ الاقتراح. تحقق من اتصال الخادم.');
    } finally {
      this.saving.set(false);
    }
  }

  async loadSaved(serviceType: ServiceType, distance: Distance): Promise<void> {
    try {
      this.saved.set(await firstValueFrom(this.api.list(serviceType, distance)));
    } catch {
      this.saved.set([]);
    }
  }
}
