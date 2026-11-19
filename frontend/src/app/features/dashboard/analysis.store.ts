import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CoverageApi } from '../../core/api/coverage-api.service';
import { CoverageResponse, Distance, DistrictCoverage, DistrictDetail, ServiceType } from '../../core/api/api.types';

export type Status = 'idle' | 'loading' | 'ready' | 'error';
export type SortKey = 'nameAr' | 'facilityCount' | 'coveragePct' | 'uncoveredAreaKm2';
export interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

/** Analysis state: settings, the current result, the ranking and the selected district. Provided per page. */
@Injectable()
export class AnalysisStore {
  private readonly api = inject(CoverageApi);
  private requestId = 0;
  private detailRequestId = 0;

  // ---- settings (bound to the command bar) ----
  readonly service = signal<ServiceType>('school');
  readonly distance = signal<Distance>(800);

  // ---- result ----
  readonly status = signal<Status>('idle');
  readonly error = signal<string | null>(null);
  readonly result = signal<CoverageResponse | null>(null);

  // ---- ranking table ----
  /** Worst -> best by default (the planner's question is "where is coverage lowest?"). */
  readonly sort = signal<Sort>({ key: 'coveragePct', dir: 'asc' });
  readonly ranking = computed<DistrictCoverage[]>(() => {
    const r = this.result();
    if (!r) return [];
    const { key, dir } = this.sort();
    const sign = dir === 'asc' ? 1 : -1;
    // Non-residential units (airport, seaport, universities) are excluded from the ranking.
    return r.districts
      .filter((d) => !d.nonResidential)
      .sort((a, b) => {
        const va = a[key] ?? '';
        const vb = b[key] ?? '';
        const c = typeof va === 'string' ? va.localeCompare(vb as string, 'ar') : (va as number) - (vb as number);
        return c * sign || a.coveragePct - b.coveragePct;
      });
  });

  // ---- selected district (detail card) ----
  readonly selectedCode = signal<string | null>(null);
  readonly detail = signal<DistrictDetail | null>(null);
  readonly detailStatus = signal<Status>('idle');
  readonly selectedRow = computed(() => this.result()?.districts.find((d) => d.districtCode === this.selectedCode()) ?? null);

  async analyze(): Promise<void> {
    const id = ++this.requestId; // ignore responses from older requests if settings change quickly
    this.status.set('loading');
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.api.coverage(this.service(), this.distance()));
      if (id !== this.requestId) return;
      this.result.set(r);
      this.status.set('ready');
      if (this.selectedCode()) void this.loadDetail(this.selectedCode()!);
    } catch {
      if (id !== this.requestId) return;
      this.status.set('error');
      this.error.set('تعذّر حساب التغطية. تحقق من اتصال الخادم ثم أعد المحاولة.');
    }
  }

  toggleSort(key: SortKey): void {
    // First click on a column shows the "worst" end first: most uncovered km2, otherwise lowest values / A→ي.
    this.sort.update((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'uncoveredAreaKm2' ? 'desc' : 'asc' },
    );
  }

  select(code: string | null): void {
    this.selectedCode.set(code);
    this.detail.set(null);
    if (code) void this.loadDetail(code);
  }

  private async loadDetail(code: string): Promise<void> {
    const id = ++this.detailRequestId;
    this.detailStatus.set('loading');
    try {
      const d = await firstValueFrom(this.api.district(code, this.distance()));
      if (id !== this.detailRequestId) return;
      this.detail.set(d);
      this.detailStatus.set('ready');
    } catch {
      if (id === this.detailRequestId) this.detailStatus.set('error');
    }
  }
}
